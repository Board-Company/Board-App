"""
Simulate two clients ("devices") against the same API by switching the
authenticated user dependency — same pattern as two phones with different JWTs.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Callable

import httpx
from starlette.applications import Starlette

if TYPE_CHECKING:
    from schemas import User


def set_active_player(
    app: Starlette,
    user: "User",
) -> None:
    """Treat the next HTTP calls as this logged-in user (replaces JWT validation)."""

    from auth import get_current_active_user

    async def _override() -> "User":
        return user

    app.dependency_overrides[get_current_active_user] = _override


def clear_auth_overrides(app: Starlette) -> None:
    from auth import get_current_active_user

    app.dependency_overrides.pop(get_current_active_user, None)


class OnlineGameSession:
    """
    Happy-path helpers for `/games` — create, join, poll, move, resign.

    Use `as_alpha` / `as_beta` before requests to mimic two devices.
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        app: Starlette,
        alpha: "User",
        beta: "User",
    ) -> None:
        self.client = client
        self.app = app
        self.alpha = alpha
        self.beta = beta

    def as_alpha(self) -> None:
        set_active_player(self.app, self.alpha)

    def as_beta(self) -> None:
        set_active_player(self.app, self.beta)

    async def create_game(self) -> tuple[str, str]:
        self.as_alpha()
        r = await self.client.post("/games")
        r.raise_for_status()
        data = r.json()
        return data["game_id"], data["invite_code"]

    async def join_with_code(self, invite_code: str) -> dict:
        self.as_beta()
        r = await self.client.post("/games/join", json={"invite_code": invite_code})
        r.raise_for_status()
        return r.json()

    async def get_state(self, game_id: str, as_player: Callable[[], None]) -> dict:
        as_player()
        r = await self.client.get(f"/games/{game_id}")
        r.raise_for_status()
        return r.json()

    async def play_move(self, game_id: str, san: str, as_player: Callable[[], None]) -> dict:
        as_player()
        r = await self.client.post(f"/games/{game_id}/move", json={"san": san})
        r.raise_for_status()
        return r.json()

    async def resign(self, game_id: str, as_player: Callable[[], None]) -> dict:
        as_player()
        r = await self.client.post(f"/games/{game_id}/resign")
        r.raise_for_status()
        return r.json()
