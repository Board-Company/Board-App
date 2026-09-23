"""A third user watches a live game with the same invite code the players used."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from schemas import User
from tests.framework.online_session import set_active_player


@pytest.fixture
def spectator() -> User:
    import uuid

    return User(
        id=str(uuid.uuid4()),
        username="test_spectator",
        email="spectator@test.local",
        disabled=False,
    )


@pytest.fixture
async def client_and_app():
    import api

    async with AsyncClient(
        transport=ASGITransport(app=api.app), base_url="http://test"
    ) as client:
        async with api.app.router.lifespan_context(api.app):
            yield client, api.app


async def _start_game(client, app, alpha, beta) -> tuple[str, str]:
    set_active_player(app, alpha)
    created = (await client.post("/games")).json()
    set_active_player(app, beta)
    await client.post("/games/join", json={"invite_code": created["invite_code"]})
    return created["game_id"], created["invite_code"]


async def test_spectator_watches_with_invite_code(
    client_and_app, device_alpha, device_beta, spectator
):
    client, app = client_and_app
    game_id, invite_code = await _start_game(client, app, device_alpha, device_beta)

    set_active_player(app, spectator)
    r = await client.post("/games/watch", json={"invite_code": invite_code})
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "spectator"
    assert body["spectator_count"] == 1
    assert body["state"]["game_id"] == game_id

    # Registered spectators can read the live state.
    assert (await client.get(f"/games/{game_id}")).status_code == 200

    # A move by a player is visible to the spectator.
    set_active_player(app, device_alpha)
    assert (await client.post(f"/games/{game_id}/move", json={"san": "e4"})).status_code == 200
    set_active_player(app, spectator)
    assert (await client.get(f"/games/{game_id}")).json()["move_history"] == ["e4"]


async def test_players_keep_their_role_when_watching(
    client_and_app, device_alpha, device_beta
):
    client, app = client_and_app
    _, invite_code = await _start_game(client, app, device_alpha, device_beta)

    set_active_player(app, device_beta)
    body = (await client.post("/games/watch", json={"invite_code": invite_code})).json()
    assert body["role"] == "black"
    assert body["spectator_count"] == 0  # players never join the spectator set


async def test_stranger_without_the_code_is_refused(
    client_and_app, device_alpha, device_beta, spectator
):
    client, app = client_and_app
    game_id, _ = await _start_game(client, app, device_alpha, device_beta)

    set_active_player(app, spectator)
    assert (await client.get(f"/games/{game_id}")).status_code == 403
    assert (await client.get(f"/games/{game_id}/events")).status_code == 403


async def test_watch_rejects_unknown_code(client_and_app, spectator):
    client, app = client_and_app
    set_active_player(app, spectator)
    assert (await client.post("/games/watch", json={"invite_code": "NOPE1234"})).status_code == 404
