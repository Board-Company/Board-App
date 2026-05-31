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

Engine queue (Phase 0–1):

- `tests/engine/test_queue_phase0.py` — LIST queue claim/ack/reclaim
- `tests/engine/test_worker_mvp.py` — worker writes `done` (mocked UCI; optional real Stockfish)
- `tests/integration/test_engine_jobs_api.py` — `POST/GET /engine/jobs`, dedupe, cancel
- `tests/engine/test_sse.py` — SSE snapshot + pub/sub notify (mocked)
- `tests/integration/test_engine_sse.py` — SSE 404 smoke test
