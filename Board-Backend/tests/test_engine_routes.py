"""POST /engine/analyse — auth, 503 when unconfigured, mocked UCI off the event loop."""
from __future__ import annotations

import shutil

import httpx
import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport

from engine.models import AnalyseResponse, EngineLine, EngineScore
from tests.framework.online_session import clear_auth_overrides, set_active_player


@pytest.fixture
async def api_client(monkeypatch: pytest.MonkeyPatch):
    """Stockfish path faked so lifespan configures engine; UCI mocked in tests."""
    monkeypatch.setattr("engine.service.resolve_stockfish_path", lambda: "/virtual/stockfish")

    from api import app

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, app
    clear_auth_overrides(app)


@pytest.mark.asyncio
async def test_analyse_requires_auth(api_client):
    client, _app = api_client
    r = await client.post("/engine/analyse", json={"fen": chess_start_fen()})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_analyse_mocked_success(api_client, device_alpha, monkeypatch: pytest.MonkeyPatch):
    client, app = api_client
    from engine import service as es

    def fake_sync(fen, profile, depth, movetime_ms, multipv):
        return AnalyseResponse(
            fen=fen,
            profile=profile,
            depth=depth,
            movetime_ms=movetime_ms,
            multipv=1,
            bestmove_uci="e2e4",
            lines=[
                EngineLine(
                    multipv=1,
                    score=EngineScore(kind="cp", value=20),
                    pv_uci=["e2e4", "e7e5"],
                )
            ],
        )

    monkeypatch.setattr(es, "analyse_position_sync", fake_sync)
    set_active_player(app, device_alpha)

    r = await client.post(
        "/engine/analyse",
        json={"fen": chess_start_fen(), "profile": "play"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["bestmove_uci"] == "e2e4"
    assert data["lines"][0]["score"]["kind"] == "cp"


@pytest.mark.asyncio
async def test_analyse_invalid_fen(api_client, device_alpha, monkeypatch: pytest.MonkeyPatch):
    client, app = api_client
    from engine import service as es

    def boom(*_a, **_k):
        raise ValueError("Invalid FEN")

    monkeypatch.setattr(es, "analyse_position_sync", boom)
    set_active_player(app, device_alpha)

    r = await client.post("/engine/analyse", json={"fen": "not-a-fen"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_analyse_503_when_not_configured(api_client, device_alpha, monkeypatch: pytest.MonkeyPatch):
    """Override configure after startup so binary appears missing for this check."""
    client, app = api_client
    from engine import service as es

    monkeypatch.setattr(es, "is_configured", lambda: False)
    set_active_player(app, device_alpha)

    r = await client.post("/engine/analyse", json={"fen": chess_start_fen()})
    assert r.status_code == 503


def chess_start_fen() -> str:
    return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@pytest.mark.skipif(not shutil.which("stockfish"), reason="stockfish not on PATH")
@pytest.mark.asyncio
async def test_analyse_real_engine_quick(device_alpha):
    """Optional: runs real Stockfish if installed (CI/local dev)."""
    from api import app
    from engine import service as es

    if not es.resolve_stockfish_path():
        pytest.skip("no stockfish")

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            set_active_player(app, device_alpha)
            r = await client.post(
                "/engine/analyse",
                json={"fen": chess_start_fen(), "depth": 6, "multipv": 1},
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["bestmove_uci"]
            assert len(data["bestmove_uci"]) in (4, 5)
            assert data["lines"]

    clear_auth_overrides(app)
