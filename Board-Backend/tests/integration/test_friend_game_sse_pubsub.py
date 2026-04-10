"""Redis pub/sub on mutations; SSE route auth (full stream read is flaky under TestClient/httpx)."""
from __future__ import annotations

import asyncio
import json
import uuid

import httpx
import pytest
from httpx import ASGITransport
from asgi_lifespan import LifespanManager

from tests.framework.online_session import OnlineGameSession, clear_auth_overrides


@pytest.fixture
async def api_client():
    from api import app

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    clear_auth_overrides(app)


@pytest.mark.asyncio
async def test_join_publishes_friend_game_state(
    api_client: httpx.AsyncClient,
    device_alpha,
    device_beta,
):
    from api import app

    redis = app.state.redis
    session = OnlineGameSession(api_client, app, device_alpha, device_beta)
    game_id, invite = await session.create_game()

    pubsub = redis.pubsub()
    await pubsub.subscribe(f"game:events:{game_id}")
    assert await pubsub.get_message(ignore_subscribe_messages=True) is None

    joined = await session.join_with_code(invite)
    assert joined["status"] == "active"

    msg = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=2.0)
    assert msg is not None and msg["type"] == "message"
    payload = json.loads(msg["data"])
    assert payload["game_id"] == game_id
    assert payload["black_player_id"] == device_beta.id

    await pubsub.unsubscribe(f"game:events:{game_id}")
    await pubsub.aclose()


@pytest.mark.asyncio
async def test_move_publishes_updated_fen(
    api_client: httpx.AsyncClient,
    device_alpha,
    device_beta,
):
    from api import app

    redis = app.state.redis
    session = OnlineGameSession(api_client, app, device_alpha, device_beta)
    game_id, invite = await session.create_game()
    await session.join_with_code(invite)

    pubsub = redis.pubsub()
    await pubsub.subscribe(f"game:events:{game_id}")
    assert await pubsub.get_message(ignore_subscribe_messages=True) is None

    after = await session.play_move(game_id, "e4", session.as_alpha)
    assert after["side_to_move"] == "b"

    msg = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=2.0)
    assert msg is not None and msg["type"] == "message"
    payload = json.loads(msg["data"])
    assert payload["game_id"] == game_id
    assert "e4" in payload["move_history"]

    await pubsub.unsubscribe(f"game:events:{game_id}")
    await pubsub.aclose()


def test_events_stream_forbidden_when_not_a_player():
    from fastapi.testclient import TestClient

    from api import app
    from schemas import User
    from tests.framework.online_session import clear_auth_overrides, set_active_player

    alpha = User(
        id=str(uuid.uuid4()),
        username="ev_alpha",
        email="ev_a@test.local",
        disabled=False,
    )
    gamma = User(
        id=str(uuid.uuid4()),
        username="ev_gamma",
        email="ev_g@test.local",
        disabled=False,
    )
    try:
        with TestClient(app) as client:
            set_active_player(app, alpha)
            r = client.post("/games")
            assert r.status_code == 200
            game_id = r.json()["game_id"]

            set_active_player(app, gamma)
            with client.stream("GET", f"/games/{game_id}/events") as resp:
                assert resp.status_code == 403
    finally:
        clear_auth_overrides(app)


def test_events_stream_404_when_game_missing():
    from fastapi.testclient import TestClient

    from api import app
    from schemas import User
    from tests.framework.online_session import clear_auth_overrides, set_active_player

    alpha = User(
        id=str(uuid.uuid4()),
        username="nf_alpha",
        email="nf_a@test.local",
        disabled=False,
    )
    try:
        with TestClient(app) as client:
            set_active_player(app, alpha)
            missing_id = str(uuid.uuid4())
            with client.stream("GET", f"/games/{missing_id}/events") as resp:
                assert resp.status_code == 404
    finally:
        clear_auth_overrides(app)
