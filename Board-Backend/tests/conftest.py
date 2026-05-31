"""
Pytest setup for Board-Backend.

`supabase_client` calls create_client at import time and rejects fake keys.
Register a stub module in sys.modules before anything imports it.
"""
from __future__ import annotations

import os
import sys
import types
import uuid
from unittest.mock import MagicMock

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder",
)
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-min-32-chars!!")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/15")
os.environ.setdefault("REDIS_ENGINE_URL", "redis://127.0.0.1:6379/14")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test.apps.googleusercontent.com")


def _fake_supabase_module() -> None:
    mock_client = MagicMock()

    def _chain(*_args, **_kwargs):
        chain = MagicMock()
        ok = MagicMock(data=[{"ok": True}])
        chain.insert.return_value.execute.return_value = ok
        chain.upsert.return_value.execute.return_value = ok
        return chain

    mock_client.table.side_effect = lambda _name: _chain()
    mod = types.ModuleType("supabase_client")
    mod.supabase = mock_client
    sys.modules["supabase_client"] = mod


_fake_supabase_module()


@pytest.fixture(autouse=True)
def _patch_redis_for_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Use in-memory Redis so tests need no real Redis server."""

    import fakeredis

    def fake_from_url(url: str, **kwargs):  # noqa: ARG001
        return fakeredis.FakeAsyncRedis(decode_responses=True)

    monkeypatch.setattr("redis.asyncio.from_url", fake_from_url)


@pytest.fixture
def device_alpha() -> "User":
    from schemas import User

    return User(
        id=str(uuid.uuid4()),
        username="test_player_alpha",
        email="alpha@test.local",
        disabled=False,
    )


@pytest.fixture
def device_beta() -> "User":
    from schemas import User

    return User(
        id=str(uuid.uuid4()),
        username="test_player_beta",
        email="beta@test.local",
        disabled=False,
    )
