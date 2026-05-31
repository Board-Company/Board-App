"""Phase 2: GET /engine/jobs/{id}/events SSE (HTTP smoke tests)."""
from __future__ import annotations

import pytest
import httpx
from httpx import ASGITransport
from asgi_lifespan import LifespanManager

from tests.framework.online_session import clear_auth_overrides, set_active_player


@pytest.fixture
async def api_client():
    from api import app

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, app
    clear_auth_overrides(app)


@pytest.mark.asyncio
async def test_sse_unknown_job_404(api_client, device_alpha):
    client, app = api_client
    set_active_player(app, device_alpha)
    r = await client.get("/engine/jobs/00000000-0000-0000-0000-000000000099/events")
    assert r.status_code == 404
