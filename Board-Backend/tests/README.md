# Board-Backend tests

## Run

```bash
cd Board-Backend
poetry run pytest
```

## Layout

- `conftest.py` — In-memory Redis (`fakeredis`), stub `supabase_client` (no real Supabase), env defaults for imports.
- `framework/online_session.py` — `OnlineGameSession` simulates **two devices** by overriding `get_current_active_user` (same as two JWTs).
- `integration/` — HTTP-level tests against the FastAPI app with ASGI lifespan.

Happy path: `tests/integration/test_friend_game_happy_path.py` — create game, join with invite code, moves, resign; verifies Redis-backed state and 404 after archive.
