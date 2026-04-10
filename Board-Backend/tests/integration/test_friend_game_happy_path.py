"""
Happy path: two distinct users (simulated devices) complete an online friend game
backed by Redis — create, join, moves, resign, archive (mocked), Redis keys cleared.
"""
from __future__ import annotations

import pytest
import httpx
from httpx import ASGITransport
from asgi_lifespan import LifespanManager

from tests.framework.online_session import OnlineGameSession, clear_auth_overrides


@pytest.fixture
async def api_client():
    """ASGI client with lifespan so Redis is attached to app.state."""
    from api import app

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    clear_auth_overrides(app)


@pytest.mark.asyncio
async def test_two_players_core_loop_create_join_moves_resign(
    api_client: httpx.AsyncClient,
    device_alpha,
    device_beta,
):
    from api import app

    session = OnlineGameSession(api_client, app, device_alpha, device_beta)

    game_id, invite_code = await session.create_game()
    assert invite_code and len(invite_code) == 8

    joined = await session.join_with_code(invite_code)
    assert joined["game_id"] == game_id
    assert joined["status"] == "active"
    assert joined["black_player_id"] == device_beta.id
    assert joined["white_player_id"] == device_alpha.id

    # Both can read
    s_white = await session.get_state(game_id, session.as_alpha)
    s_black = await session.get_state(game_id, session.as_beta)
    assert s_white["fen"] == s_black["fen"]

    # White opens
    after_e4 = await session.play_move(game_id, "e4", session.as_alpha)
    assert after_e4["side_to_move"] == "b"

    # Black replies
    after_e5 = await session.play_move(game_id, "e5", session.as_beta)
    assert after_e5["side_to_move"] == "w"

    # White resigns — terminal path, archive + Redis delete
    final = await session.resign(game_id, session.as_alpha)
    assert final["status"] == "finished"
    assert final["result"] == "0-1"

    # Game no longer in Redis
    session.as_alpha()
    gone = await api_client.get(f"/games/{game_id}")
    assert gone.status_code == 404
