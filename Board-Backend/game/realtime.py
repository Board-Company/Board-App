"""Redis pub/sub for live friend-game updates (SSE subscribers)."""

from __future__ import annotations

from redis.asyncio import Redis

from game.models import FriendGameState

GAME_EVENTS_PREFIX = "game:events:"


def game_events_channel(game_id: str) -> str:
    return f"{GAME_EVENTS_PREFIX}{game_id}"


async def publish_friend_game_state(redis: Redis, state: FriendGameState) -> None:
    """Notify subscribers; payload matches GET /games/{game_id} JSON."""
    await redis.publish(game_events_channel(state.game_id), state.model_dump_json())
