import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis

from auth import get_current_active_user
from game.models import (
    CompletedGameSummary,
    CreateGameResponse,
    FriendGameState,
    JoinGameRequest,
    MoveRequestBody,
)
from game.realtime import game_events_channel
from game.service import (
    apply_move,
    create_friend_game,
    get_friend_game,
    join_friend_game,
    resign_friend_game,
)
from schemas import User
from supabase_client import supabase

router = APIRouter()

_COMPLETED_SELECT = (
    "id, game_id, white_player_id, black_player_id, move_history, final_fen, result, "
    "finished_reason, started_at, finished_at, "
    "white_player:users!completed_games_white_player_id_fkey(username), "
    "black_player:users!completed_games_black_player_id_fkey(username)"
)


def _completed_row_to_summary(row: dict) -> CompletedGameSummary:
    wp = row.get("white_player") or {}
    bp = row.get("black_player") or {}
    wu = wp.get("username") if isinstance(wp, dict) else None
    bu = bp.get("username") if isinstance(bp, dict) else None
    mh = row.get("move_history") or []
    if isinstance(mh, str):
        mh = json.loads(mh) if mh else []
    return CompletedGameSummary(
        id=str(row["id"]),
        game_id=str(row["game_id"]),
        white_player_id=str(row["white_player_id"]),
        black_player_id=str(row["black_player_id"]),
        white_username=str(wu) if wu is not None else None,
        black_username=str(bu) if bu is not None else None,
        move_history=list(mh),
        final_fen=row["final_fen"],
        result=row["result"],
        finished_reason=row.get("finished_reason"),
        started_at=str(row["started_at"]),
        finished_at=str(row["finished_at"]),
    )


def _redis(request: Request) -> Redis:
    r = getattr(request.app.state, "redis", None)
    if r is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis is not available",
        )
    return r


def _user_id(user: User) -> str:
    if not user.id:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User id missing; ensure users row has id and re-login if needed",
        )
    return str(user.id)


@router.get("/me/completed", response_model=list[CompletedGameSummary])
async def list_my_completed_games(
    current_user: User = Depends(get_current_active_user),
):
    uid = _user_id(current_user)
    try:
        res = (
            supabase.table("completed_games")
            .select(_COMPLETED_SELECT)
            .or_(f"white_player_id.eq.{uid},black_player_id.eq.{uid}")
            .order("finished_at", desc=True)
            .limit(50)
            .execute()
        )
    except Exception:
        res = (
            supabase.table("completed_games")
            .select("*")
            .or_(f"white_player_id.eq.{uid},black_player_id.eq.{uid}")
            .order("finished_at", desc=True)
            .limit(50)
            .execute()
        )
    rows = res.data or []
    return [_completed_row_to_summary(r) for r in rows]


@router.get("/me/completed/{game_id}", response_model=CompletedGameSummary)
async def get_my_completed_game(
    game_id: str,
    current_user: User = Depends(get_current_active_user),
):
    uid = _user_id(current_user)
    try:
        res = (
            supabase.table("completed_games")
            .select(_COMPLETED_SELECT)
            .eq("game_id", game_id)
            .limit(1)
            .execute()
        )
    except Exception:
        res = (
            supabase.table("completed_games")
            .select("*")
            .eq("game_id", game_id)
            .limit(1)
            .execute()
        )
    rows = res.data or []
    if not rows:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    row = rows[0]
    if row.get("white_player_id") != uid and row.get("black_player_id") != uid:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    return _completed_row_to_summary(row)


@router.post("/join", response_model=FriendGameState)
async def join_game(
    request: Request,
    body: JoinGameRequest,
    current_user: User = Depends(get_current_active_user),
):
    redis = _redis(request)
    return await join_friend_game(
        redis,
        body.game_id,
        body.invite_code,
        _user_id(current_user),
        current_user.username,
    )


@router.post("", response_model=CreateGameResponse)
async def create_game(
    request: Request,
    current_user: User = Depends(get_current_active_user),
):
    redis = _redis(request)
    return await create_friend_game(redis, _user_id(current_user), current_user.username)


_STREAM_KEEPALIVE_SEC = 25.0


@router.get("/{game_id}/events")
async def game_events_stream(
    request: Request,
    game_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Server-Sent Events: initial `FriendGameState` JSON, then Redis pub/sub pushes on each update.
    Requires `Authorization: Bearer` (same as other `/games` routes).
    """
    redis = _redis(request)
    uid = _user_id(current_user)
    initial = await get_friend_game(redis, game_id, uid)
    initial_json = initial.model_dump_json()

    async def event_generator():
        pubsub = redis.pubsub()
        channel = game_events_channel(game_id)
        await pubsub.subscribe(channel)
        try:
            yield f"data: {initial_json}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=_STREAM_KEEPALIVE_SEC,
                )
                if msg is None:
                    yield ": keepalive\n\n"
                    continue
                if msg.get("type") == "message" and msg.get("data"):
                    payload = msg["data"]
                    if isinstance(payload, bytes):
                        payload = payload.decode("utf-8")
                    yield f"data: {payload}\n\n"
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                pass
            try:
                await pubsub.close()
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{game_id}", response_model=FriendGameState)
async def read_game(
    request: Request,
    game_id: str,
    current_user: User = Depends(get_current_active_user),
):
    redis = _redis(request)
    return await get_friend_game(redis, game_id, _user_id(current_user))


@router.post("/{game_id}/move", response_model=FriendGameState)
async def post_move(
    request: Request,
    game_id: str,
    body: MoveRequestBody,
    current_user: User = Depends(get_current_active_user),
):
    redis = _redis(request)
    return await apply_move(redis, supabase, game_id, _user_id(current_user), body.san)


@router.post("/{game_id}/resign", response_model=FriendGameState)
async def post_resign(
    request: Request,
    game_id: str,
    current_user: User = Depends(get_current_active_user),
):
    redis = _redis(request)
    return await resign_friend_game(redis, supabase, game_id, _user_id(current_user))
