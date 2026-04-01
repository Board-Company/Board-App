"""Friend chess: Redis live state, archive to Supabase on terminal."""
from __future__ import annotations

import json
import secrets
import string
import uuid
from datetime import datetime, timezone

import chess
from fastapi import HTTPException, status
from loguru import logger
from redis.asyncio import Redis
from supabase import Client

from game.models import CreateGameResponse, FriendGameState

GAME_PREFIX = "game:"
INVITE_PREFIX = "invite:"
TTL_SEC = 48 * 3600
INVITE_ALPHABET = string.ascii_uppercase + string.digits


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _invite_code() -> str:
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(8))


def _dict_to_state(d: dict) -> FriendGameState:
    return FriendGameState(
        game_id=d["game_id"],
        fen=d["fen"],
        move_history=d.get("move_history") or [],
        status=d["status"],
        side_to_move=d["side_to_move"],
        white_player_id=d.get("white_player_id"),
        black_player_id=d.get("black_player_id"),
        white_username=d.get("white_username"),
        black_username=d.get("black_username"),
        invite_code=d.get("invite_code"),
        result=d.get("result"),
        finished_reason=d.get("finished_reason"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


async def _load_raw(redis: Redis, game_id: str) -> dict | None:
    raw = await redis.get(f"{GAME_PREFIX}{game_id}")
    if not raw:
        return None
    return json.loads(raw)


def _terminal_result(board: chess.Board) -> tuple[str, str]:
    if board.is_checkmate():
        res = "0-1" if board.turn == chess.WHITE else "1-0"
        return res, "checkmate"
    if board.is_stalemate():
        return "1/2-1/2", "stalemate"
    if board.is_insufficient_material():
        return "1/2-1/2", "insufficient_material"
    if board.is_seventyfive_moves():
        return "1/2-1/2", "seventyfive_moves"
    if board.is_fivefold_repetition():
        return "1/2-1/2", "fivefold_repetition"
    return "1/2-1/2", "draw"


async def _persist_state(redis: Redis, state: dict) -> None:
    state["updated_at"] = _now_iso()
    await redis.set(
        f"{GAME_PREFIX}{state['game_id']}",
        json.dumps(state),
        ex=TTL_SEC,
    )


async def _archive_and_clear(redis: Redis, supabase: Client, state: dict) -> None:
    gid = state["game_id"]
    row = {
        "game_id": gid,
        "white_player_id": state["white_player_id"],
        "black_player_id": state["black_player_id"],
        "move_history": state.get("move_history") or [],
        "final_fen": state["fen"],
        "result": state["result"],
        "finished_reason": state.get("finished_reason"),
        "started_at": state["created_at"],
        "finished_at": _now_iso(),
    }
    try:
        # Idempotent: duplicate finish (e.g. retry) merges on game_id unique constraint
        supabase.table("completed_games").upsert(row, on_conflict="game_id").execute()
    except Exception as e:
        logger.exception("completed_games insert failed: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to archive game (run completed_games SQL in Supabase if missing)",
        ) from e

    await redis.delete(f"{GAME_PREFIX}{gid}")
    code = state.get("invite_code")
    if code:
        await redis.delete(f"{INVITE_PREFIX}{code}")


async def create_friend_game(redis: Redis, user_id: str, username: str) -> CreateGameResponse:
    gid = str(uuid.uuid4())
    now = _now_iso()
    board = chess.Board()
    state: dict = {
        "game_id": gid,
        "fen": board.fen(),
        "move_history": [],
        "status": "waiting",
        "side_to_move": "w",
        "white_player_id": user_id,
        "black_player_id": None,
        "white_username": username,
        "black_username": None,
        "invite_code": None,
        "result": None,
        "finished_reason": None,
        "created_at": now,
        "updated_at": now,
    }
    for _ in range(32):
        code = _invite_code()
        inv_key = f"{INVITE_PREFIX}{code}"
        ok = await redis.set(inv_key, gid, nx=True, ex=TTL_SEC)
        if ok:
            state["invite_code"] = code
            await redis.set(f"{GAME_PREFIX}{gid}", json.dumps(state), ex=TTL_SEC)
            return CreateGameResponse(game_id=gid, invite_code=code)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not allocate invite code",
    )


async def join_friend_game(
    redis: Redis,
    game_id: str | None,
    invite_code: str | None,
    user_id: str,
    username: str,
) -> FriendGameState:
    if invite_code:
        gid = await redis.get(f"{INVITE_PREFIX}{invite_code.strip().upper()}")
        if not gid:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")
    elif game_id:
        gid = game_id
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide game_id or invite_code",
        )

    state = await _load_raw(redis, gid)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    if state["white_player_id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot join your own game as opponent",
        )

    if state.get("black_player_id"):
        if state["black_player_id"] == user_id:
            return _dict_to_state(state)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Game is full")

    state["black_player_id"] = user_id
    state["black_username"] = username
    state["status"] = "active"
    await _persist_state(redis, state)
    return _dict_to_state(state)


async def get_friend_game(redis: Redis, game_id: str, user_id: str) -> FriendGameState:
    state = await _load_raw(redis, game_id)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    if user_id not in (state["white_player_id"], state.get("black_player_id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a player in this game")
    return _dict_to_state(state)


async def apply_move(
    redis: Redis,
    supabase: Client,
    game_id: str,
    user_id: str,
    san: str,
) -> FriendGameState:
    state = await _load_raw(redis, game_id)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    if user_id not in (state["white_player_id"], state.get("black_player_id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a player in this game")
    if state["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is not active (waiting for opponent or already finished)",
        )
    if not state.get("black_player_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Waiting for opponent to join",
        )

    board = chess.Board(state["fen"])
    is_white_turn = board.turn == chess.WHITE
    if is_white_turn and user_id != state["white_player_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="White to move")
    if not is_white_turn and user_id != state["black_player_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Black to move")

    try:
        board.push_san(san.strip())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Illegal or ambiguous SAN",
        ) from None

    state["fen"] = board.fen()
    state["move_history"] = (state.get("move_history") or []) + [san.strip()]
    state["side_to_move"] = "w" if board.turn == chess.WHITE else "b"

    if board.is_game_over():
        state["status"] = "finished"
        state["result"], state["finished_reason"] = _terminal_result(board)
        out = _dict_to_state(state)
        await _archive_and_clear(redis, supabase, state)
        return out

    await _persist_state(redis, state)
    return _dict_to_state(state)


async def resign_friend_game(
    redis: Redis,
    supabase: Client,
    game_id: str,
    user_id: str,
) -> FriendGameState:
    state = await _load_raw(redis, game_id)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    if state["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only resign an active game",
        )
    if user_id == state["white_player_id"]:
        state["result"] = "0-1"
    elif user_id == state["black_player_id"]:
        state["result"] = "1-0"
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a player in this game")

    state["finished_reason"] = "resign"
    state["status"] = "finished"
    out = _dict_to_state(state)
    await _archive_and_clear(redis, supabase, state)
    return out
