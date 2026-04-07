# API routes

Living reference for **Board-Backend** (`FastAPI`). Main app: [`Board-Backend/api.py`](../Board-Backend/api.py). Game routes: [`Board-Backend/game/routes.py`](../Board-Backend/game/routes.py), mounted at **`/games`** (prefix in `api.py`).

There are **no WebSocket** endpoints. Live friend-game updates use **HTTP** plus optional **SSE** (`GET /games/{game_id}/events`) backed by **Redis pub/sub**; clients can still poll `GET /games/{game_id}`.

## Base URLs and environments

Set per deployment. Local dev commonly uses port **8000** (see `uvicorn` usage in repo). **`REDIS_URL`** and Supabase credentials are required for full behavior.

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

_Last updated: 2026-04-07_
