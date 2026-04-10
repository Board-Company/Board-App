# API routes

Living reference for **Board-Backend** (`FastAPI`). Main app: [`Board-Backend/api.py`](../Board-Backend/api.py). Game routes: [`Board-Backend/game/routes.py`](../Board-Backend/game/routes.py), mounted at **`/games`** (prefix in `api.py`). Engine routes: [`Board-Backend/engine/routes.py`](../Board-Backend/engine/routes.py), mounted at **`/engine`**.

There are **no WebSocket** endpoints. Live friend-game updates use **HTTP** plus optional **SSE** (`GET /games/{game_id}/events`) backed by **Redis pub/sub**; clients can still poll `GET /games/{game_id}`.

## Base URLs and environments

Set per deployment. Local dev commonly uses port **8000** (see `uvicorn` usage in repo). **`REDIS_URL`** and Supabase credentials are required for full behavior (friend games, auth-backed data). Optional: **`STOCKFISH_PATH`** or install **`stockfish`** on **`PATH`** so `POST /engine/analyse` returns **200** instead of **503**.

## Authentication

- **JWT**: `Authorization: Bearer <access_token>`. Payload `sub` is **`username`** (not user id). Validation and user load: [`Board-Backend/auth.py`](../Board-Backend/auth.py) (`get_current_active_user`, etc.).
- **OAuth2 password flow**: `POST /token` uses `OAuth2PasswordRequestForm` (`username`, `password`).
- **Lichess login start**: optional `Authorization: Bearer` on `GET /auth/lichess/login` to associate linking with the current app user.

Protected routes below note **Bearer**.

## General

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | No | Service message (`Board API is running`). |
| GET | `/health` | No | `status` + `redis` bool (ping). |

## Engine (`/engine…`)

Server-side **Stockfish** (UCI) via `python-chess`. Requires a **Stockfish binary**: set **`STOCKFISH_PATH`** to the executable, or install `stockfish` on **`PATH`**. If neither is available at startup, **`POST /engine/analyse`** returns **503** until configured. UCI runs on a **worker thread** (`asyncio.to_thread`), not on the asyncio event loop.

| Method | Path | Auth | Request body | Response (summary) |
|--------|------|------|----------------|-------------------|
| POST | `/engine/analyse` | Bearer | `AnalyseRequest`: `fen`; optional `profile` (`play` \| `analysis`); optional `depth` (1–64), `movetime_ms` (50–600000), `multipv` (1–5) | `AnalyseResponse`: normalized `fen`, effective `depth` / `movetime_ms` / `multipv`, `bestmove_uci`, `lines[]` with `multipv`, `score` (`cp` \| `mate`, White POV), `pv_uci` |

**Profiles:** `play` defaults to **movetime 200 ms** and **multipv 1** when depth/movetime omitted. `analysis` defaults to **depth 18** and **multipv 3**. With no profile, defaults are **depth 12** and **multipv 1** if depth and movetime are both omitted.

**Errors:** **400** invalid FEN; **502** engine process / UCI failure; **503** engine not configured.

**DTOs:** [`Board-Backend/engine/models.py`](../Board-Backend/engine/models.py) — `AnalyseRequest`, `AnalyseResponse`, `EngineLine`, `EngineScore`.

## Users and auth

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/token` | No | Login; returns `access_token`, `token_type`, `user` (public fields, incl. `name` for display). |
| POST | `/register` | No | Create user (`UserCreate`: username, email, password). |
| GET | `/users/me` | Bearer | Current user profile. |
| POST | `/auth/google` | No | `GoogleAuthRequest` with Google ID token; verify and return JWT + `user`. |
| GET | `/auth/lichess/login` | Optional Bearer | Start Lichess OAuth (PKCE); returns `auth_url` (and related payload). |
| GET | `/auth/lichess/callback` | Browser redirect | Lichess OAuth callback; upsert `lichess_users`; may redirect to app deep link `boardapp://auth/lichess/callback?...`. |
| POST | `/users/link-lichess` | Bearer | Link Lichess username / flags on `users`. |
| POST | `/users/unlink-lichess` | Bearer | Clear Lichess link fields. |
| GET | `/users/lichess-info` | Bearer | `lichess_users` row for current user’s `lichess_username`. |

## Games (`/games…`)

All game endpoints require **Bearer** except none under this router — all use `get_current_active_user`. Game mutations need Redis; if Redis is missing, handlers return **503** (“Redis is not available”).

| Method | Path | Request body | Response (summary) |
|--------|------|----------------|-------------------|
| GET | `/games/me/completed` | — | Up to **50** `CompletedGameSummary` rows (user is white or black), newest `finished_at` first. |
| GET | `/games/me/completed/{game_id}` | — | One archived game by **logical** `game_id` (UUID). **404** if missing or user not a participant. |
| POST | `/games/join` | `JoinGameRequest`: optional `game_id`, optional `invite_code` (at least one needed for join) | `FriendGameState` |
| POST | `/games` | — | `CreateGameResponse`: `game_id`, `invite_code` (white = caller) |
| GET | `/games/{game_id}` | — | `FriendGameState` (must be a player) |
| GET | `/games/{game_id}/events` | — | **SSE** (`text/event-stream`): first frame is current `FriendGameState` JSON; later frames repeat on Redis publish after join/move/resign/create (payload matches GET). Comment lines `: keepalive` between idle periods. |
| POST | `/games/{game_id}/move` | `MoveRequestBody`: `san` (SAN string) | `FriendGameState` (may archive to Supabase if terminal) |
| POST | `/games/{game_id}/resign` | — | `FriendGameState` after resign + archive |

### Response models (reference)

Defined in [`Board-Backend/game/models.py`](../Board-Backend/game/models.py):

- **`FriendGameState`**: `game_id`, `fen`, `move_history`, `status` (`waiting` | `active` | `finished`), `side_to_move` (`w` | `b`), player ids/usernames, `invite_code`, optional `result` / `finished_reason`, timestamps.
- **`CompletedGameSummary`**: archived row + `white_username` / `black_username` when joins succeed.

## CORS

[`api.py`](../Board-Backend/api.py) uses permissive CORS (`allow_origins=["*"]`) — tighten for production.

## Versioning

No `/v1` prefix today; breaking changes should be documented here when introduced.

---

_Last updated: 2026-04-09_
