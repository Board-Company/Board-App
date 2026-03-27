from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis

from auth import get_current_active_user
from game.models import CreateGameResponse, FriendGameState, JoinGameRequest, MoveRequestBody
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
