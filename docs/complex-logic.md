# Complex logic

Living reference for **non-obvious** flows, invariants, and cross-module behavior. Prefer short sections; link to code for details.

## When to add an entry

- Matching, game lifecycle, reconciliation, or sync logic that spans multiple files
- Race conditions or ordering assumptions that maintainers must know
- Business rules that are not clear from types alone

## Entries

### Friend chess: Redis live state → Supabase archive

- **Where in code:** [`Board-Backend/game/service.py`](../Board-Backend/game/service.py) (locks, TTL, `_archive_and_clear`), [`Board-Backend/game/routes.py`](../Board-Backend/game/routes.py) (HTTP).
- **Summary:** Active games live in Redis under `game:{id}`; terminal positions (checkmate, draw rules via `python-chess`, or resign) trigger insert/upsert into `completed_games`, then Redis keys are cleared. Invite codes map through `invite:{code}` with the same TTL as the game.
- **Edge cases:** Mutations use a short-lived Redis lock; without Redis the API returns 503 for game routes. JWT identifies the user by **username** while game rows use **user id** for player columns.

### Friend chess client: resume + deep links

- **Where in code:** [`nimbus/src/services/activeFriendGame.ts`](../nimbus/src/services/activeFriendGame.ts) (persisted `game_id`), [`nimbus/src/screens/friendGame.tsx`](../nimbus/src/screens/friendGame.tsx) (hydrate on mount, clear on leave / finished / missing game), [`nimbus/src/App.tsx`](../nimbus/src/App.tsx) (`linking` for `boardapp://`).
- **Summary:** The active friend `game_id` is stored locally while a match is in progress so leaving the screen or restarting the app can **resume** the same Redis-backed game. **Leave** clears storage and route params (so a stale deep-link param does not force re-entry). Finished games clear storage when navigating to review. Deep links (no server “game restart” needed): prefer `boardapp://friend-game/<game_id>`; `boardapp:///friend-game/<game_id>` and `boardapp:friend-game/<game_id>` are also normalized in [`nimbus/src/App.tsx`](../nimbus/src/App.tsx). If a link opens the app but not Friend Game, reload JS after deploy and try the URL **while the app is running** once; cold-start timing can occasionally drop the initial URL on some devices.

### Friend chess: Redis pub/sub → SSE → app

- **Where in code:** [`Board-Backend/game/realtime.py`](../Board-Backend/game/realtime.py) (channel + `publish_friend_game_state`), [`Board-Backend/game/service.py`](../Board-Backend/game/service.py) (publish after mutations), [`Board-Backend/game/routes.py`](../Board-Backend/game/routes.py) (`GET /{game_id}/events`), [`nimbus/src/screens/friendGame.tsx`](../nimbus/src/screens/friendGame.tsx) (`rn-eventsource` + `Authorization` header; **poll every 2.5s** only if the stream errors).
- **Summary:** Each live game has a Redis channel `game:events:{game_id}`. On create/join/move/resign the API **PUBLISH**es a `FriendGameState` JSON string. The SSE handler **SUBSCRIBE**s, sends the current state as the first `data:` event, then forwards publishes. Moves are still submitted with **`POST /games/{id}/move`** (not over SSE). If SSE fails (token, proxy, network), the app falls back to polling `GET /games/{id}`.

### Stockfish: UCI off the event loop

- **Where in code:** [`Board-Backend/engine/service.py`](../Board-Backend/engine/service.py) (singleton subprocess + `threading.Lock`, `analyse_position_sync`), [`Board-Backend/engine/routes.py`](../Board-Backend/engine/routes.py) (`POST /analyse` → `asyncio.to_thread`), [`Board-Backend/api.py`](../Board-Backend/api.py) (lifespan: `resolve_stockfish_path`, `configure`, shutdown `quit()`).
- **Summary:** Blocking **python-chess** UCI calls run only inside **`asyncio.to_thread`** so the FastAPI loop stays responsive. One **Stockfish** process is reused per API process under a lock (concurrent requests serialize). **503** if no binary at `STOCKFISH_PATH` or on `PATH`. Scores in JSON are from **White’s perspective** (`PovScore.white()`). **MVP uses no Redis or Postgres for engine state** — see [database-schema.md](database-schema.md) (“Engine (Stockfish)”). Optional queue/SSE live PV and future **`engine:*`** keys are in [`docs/plans/stockfish-queue-live-analysis.plan.md`](./plans/stockfish-queue-live-analysis.plan.md).

---

_Add new subsections above this line as the project grows._

---

_Last updated: 2026-04-09_
