"""Phase 1: POST/GET /engine/jobs HTTP routes."""
from __future__ import annotations

import pytest
import httpx
from httpx import ASGITransport
from asgi_lifespan import LifespanManager

from tests.framework.online_session import clear_auth_overrides, set_active_player

START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@pytest.fixture
async def api_client():
    from api import app

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, app
    clear_auth_overrides(app)


@pytest.mark.asyncio
async def test_post_engine_job_returns_queued(api_client, device_alpha):
    client, app = api_client
    set_active_player(app, device_alpha)

    r = await client.post(
        "/engine/jobs",
        json={"fen": START_FEN, "depth": 10, "profile": "play"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["dedupe_hit"] is False
    job_id = body["job_id"]

    g = await client.get(f"/engine/jobs/{job_id}")
    assert g.status_code == 200
    data = g.json()
    assert data["status"] == "queued"
    assert data["fen"] == START_FEN
    assert data["payload"]["depth"] == 10


@pytest.mark.asyncio
async def test_dedupe_on_repeat_post(api_client, device_alpha):
    client, app = api_client
    set_active_player(app, device_alpha)

    r1 = await client.post("/engine/jobs", json={"fen": START_FEN, "depth": 8})
    r2 = await client.post("/engine/jobs", json={"fen": START_FEN, "depth": 8})
    assert r1.json()["job_id"] == r2.json()["job_id"]
    assert r2.json()["dedupe_hit"] is True


@pytest.mark.asyncio
async def test_idempotency_key_header(api_client, device_alpha):
    client, app = api_client
    set_active_player(app, device_alpha)
    headers = {"Idempotency-Key": "test-idem-123"}

    r1 = await client.post(
        "/engine/jobs",
        json={"fen": START_FEN, "depth": 6},
        headers=headers,
    )
    r2 = await client.post(
        "/engine/jobs",
        json={"fen": START_FEN, "depth": 6},
        headers=headers,
    )
    assert r1.json()["job_id"] == r2.json()["job_id"]
    assert r2.json()["dedupe_hit"] is True


@pytest.mark.asyncio
async def test_get_unknown_job_404(api_client, device_alpha):
    client, app = api_client
    set_active_player(app, device_alpha)
    r = await client.get("/engine/jobs/00000000-0000-0000-0000-000000000099")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_invalid_fen_422(api_client, device_alpha):
    client, app = api_client
    set_active_player(app, device_alpha)
    r = await client.post("/engine/jobs", json={"fen": "not-a-fen", "depth": 5})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_cancel_job(api_client, device_alpha):
    client, app = api_client
    set_active_player(app, device_alpha)
    job_id = (await client.post("/engine/jobs", json={"fen": START_FEN, "depth": 5})).json()[
        "job_id"
    ]
    c = await client.post(f"/engine/jobs/{job_id}/cancel")
    assert c.status_code == 200
    data = (await client.get(f"/engine/jobs/{job_id}")).json()
    assert data["cancel_requested"] is True
