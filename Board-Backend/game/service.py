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
LOCK_PREFIX = "lock:game:"
# Survives past main `game:{id}` TTL so a sweeper can insert an analytics row (abandoned / expired).
SHADOW_PREFIX = "game:shadow:"
TTL_SEC = 48 * 3600
SHADOW_GRACE_SEC = 24 * 3600
LOCK_TTL_SEC = 5
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


async def _acquire_game_lock(redis: Redis, game_id: str) -> str:
    token = str(uuid.uuid4())
    ok = await redis.set(
        f"{LOCK_PREFIX}{game_id}",
        token,
        nx=True,
        ex=LOCK_TTL_SEC,
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Game is busy, retry",
        )
    return token


async def _release_game_lock(redis: Redis, game_id: str, token: str) -> None:
    # Delete the lock only if this request still owns it.
    await redis.eval(
        """
        if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
        end
        return 0
        """,
        1,
        f"{LOCK_PREFIX}{game_id}",
        token,
    )


async def _write_shadow(redis: Redis, state: dict) -> None:
    """Compact snapshot for abandoned-game archival after live `game:{id}` TTL expires."""
    gid = state["game_id"]
    snap = {
        "game_id": gid,
        "white_player_id": state.get("white_player_id"),
        "black_player_id": state.get("black_player_id"),
        "fen": state.get("fen"),
        "move_history": state.get("move_history") or [],
        "created_at": state.get("created_at"),
    }
    await redis.set(
        f"{SHADOW_PREFIX}{gid}",
        json.dumps(snap),
        ex=TTL_SEC + SHADOW_GRACE_SEC,
    )


async def _delete_shadow(redis: Redis, game_id: str) -> None:
    await redis.delete(f"{SHADOW_PREFIX}{game_id}")


async def _persist_state(redis: Redis, state: dict) -> None:
    state["updated_at"] = _now_iso()
    await redis.set(
        f"{GAME_PREFIX}{state['game_id']}",
        json.dumps(state),
        ex=TTL_SEC,
    )
    await _write_shadow(redis, state)


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
    await _delete_shadow(redis, gid)
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
            await _write_shadow(redis, state)
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
        gid = str(gid)
    elif game_id:
        gid = game_id
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide game_id or invite_code",
        )

    lock_token = await _acquire_game_lock(redis, gid)
    try:
        state = await _load_raw(redis, gid)
        if not state:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

        if state["white_player_id"] == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot join your own game as opponent",
            )

        # Black seat: one user only; never overwrite an existing opponent.
        black_id = state.get("black_player_id")
        if black_id:
            if black_id == user_id:
                return _dict_to_state(state)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Black seat is already taken",
            )

        state["black_player_id"] = user_id
        state["black_username"] = username
        state["status"] = "active"
        await _persist_state(redis, state)
        return _dict_to_state(state)
    finally:
        await _release_game_lock(redis, gid, lock_token)


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
    lock_token = await _acquire_game_lock(redis, game_id)
    try:
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
    finally:
        await _release_game_lock(redis, game_id, lock_token)


async def resign_friend_game(
    redis: Redis,
    supabase: Client,
    game_id: str,
    user_id: str,
) -> FriendGameState:
    lock_token = await _acquire_game_lock(redis, game_id)
    try:
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
    finally:
        await _release_game_lock(redis, game_id, lock_token)


async def _archive_abandoned_from_shadow(redis: Redis, supabase: Client, raw: dict) -> None:
    gid = raw["game_id"]
    row = {
        "game_id": gid,
        "white_player_id": raw["white_player_id"],
        "black_player_id": raw.get("black_player_id"),
        "move_history": raw.get("move_history") or [],
        "final_fen": raw.get("fen") or chess.Board().fen(),
        "result": "abandoned",
        "finished_reason": "expired",
        "started_at": raw["created_at"],
        "finished_at": _now_iso(),
    }
    supabase.table("completed_games").upsert(row, on_conflict="game_id").execute()
    await redis.delete(f"{SHADOW_PREFIX}{gid}")


async def sweep_abandoned_friend_games(redis: Redis, supabase: Client) -> int:
    """
    When `game:{id}` TTL has passed but `game:shadow:{id}` remains, insert `abandoned` / `expired`
    into Supabase (analytics). If the game was already archived normally, drop the orphan shadow only.
    """
    archived = 0
    async for key in redis.scan_iter(match=f"{SHADOW_PREFIX}*"):
        game_id = key.removeprefix(SHADOW_PREFIX)
        if await redis.exists(f"{GAME_PREFIX}{game_id}"):
            continue
        raw_s = await redis.get(key)
        if not raw_s:
            continue
        try:
            raw = json.loads(raw_s)
        except json.JSONDecodeError:
            await redis.delete(key)
            continue
        try:
            gid = raw.get("game_id", game_id)
            existing = (
                supabase.table("completed_games")
                .select("game_id")
                .eq("game_id", gid)
                .limit(1)
                .execute()
            )
            if existing.data:
                await redis.delete(key)
                continue
            await _archive_abandoned_from_shadow(redis, supabase, raw)
            archived += 1
        except Exception:
            logger.exception("abandoned friend game sweep failed for key={}", key)
    return archived
