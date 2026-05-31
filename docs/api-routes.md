# API routes (Board-Backend)

Base URL: `http://localhost:8000` (or your deployed `BASE_URL` in Nimbus `.env`).

Auth: unless noted, send `Authorization: Bearer <JWT>` from `POST /token` or Google sign-in.

There are **no WebSocket** endpoints. Live friend-game updates use **HTTP** plus optional **SSE** (`GET /games/{game_id}/events`) backed by **Redis pub/sub**; clients can still poll `GET /games/{game_id}`.

---

## Health & auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Liveness message |
| GET | `/health` | No | `{ status, redis, redis_engine }` — friend Redis (db 0) + engine Redis (db 1) |
| POST | `/token` | No | Login (OAuth2 form: username + password) → JWT |
| POST | `/register` | No | Create user |
| POST | `/auth/google` | No | Google ID token → JWT |
| GET | `/auth/lichess/login` | Optional | Start Lichess OAuth |
| GET | `/auth/lichess/callback` | No | Lichess OAuth callback (redirect) |
| GET | `/users/me` | Yes | Current user |
| GET | `/users/lichess-info` | Yes | Linked Lichess profile |
| POST | `/users/link-lichess` | Yes | Link Lichess username |
| POST | `/users/unlink-lichess` | Yes | Unlink Lichess |

---

## Friend chess (`/games`)

Requires **`REDIS_URL`** (Redis db **0**). Returns **503** if Redis is down.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/games` | Create lobby → `{ game_id, invite_code }` |
| POST | `/games/join` | Body: `{ invite_code }` or `{ game_id }` |
| GET | `/games/{game_id}` | Live state (poll ~2.5s fallback while active) |
| GET | `/games/{game_id}/events` | **SSE** — snapshot then live updates via Redis pub/sub |
| POST | `/games/{game_id}/move` | Body: `{ san }` — validated with python-chess |
| POST | `/games/{game_id}/resign` | Resign → archive to Supabase, delete Redis keys |
| GET | `/games/me/completed` | List your archived friend games |
| GET | `/games/me/completed/{game_id}` | One archived game (review / history) |

### GET `/games/{game_id}/events` (SSE)

`Content-Type: text/event-stream`

1. First `data:` line = current `FriendGameState` JSON.
2. Further `data:` lines after API **PUBLISH** on `game:events:{game_id}` (join/move/resign/create).
3. Comment lines `: keepalive` between idle periods.

Nimbus: `rn-eventsource` with `Authorization` header; falls back to polling `GET /games/{id}` (~2.5s) if SSE fails.

See [complex-logic.md](complex-logic.md#friend-chess-redis--supabase) for Redis keys and lifecycle.

---

## Stockfish engine jobs (`/engine`)

Requires **`REDIS_ENGINE_URL`** (Redis db **1** by default). API **never runs Stockfish** — it enqueues jobs; one or more **`engine-worker`** processes run UCI (Docker stack defaults to **3** replicas — up to 3 jobs analyzed in parallel).

Returns **503** if engine Redis is unavailable.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/engine/jobs` | Enqueue analysis job → `{ job_id, dedupe_hit }` |
| GET | `/engine/jobs/{job_id}` | Job status + latest `result` from Redis hash |
| GET | `/engine/jobs/{job_id}/events` | **SSE** — snapshot then live updates (see below) |
| POST | `/engine/jobs/{job_id}/cancel` | Set `cancel_requested` on job hash |

### POST `/engine/jobs`

**Headers (optional):** `Idempotency-Key: <uuid>`

**Body** (JSON):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `fen` | string | live analysis | Legal FEN; mutually exclusive with `game_id`+`ply` |
| `game_id` | string | archived review | With `ply`, API loads `completed_games` and replays to FEN |
| `ply` | int | with `game_id` | Half-move index (0 = start position) |
| `depth` | int | yes | 1–30 (`ENGINE_MAX_DEPTH`) |
| `multipv` | int | no | Default 1 |
| `profile` | string | no | `play` \| `analysis` |
| `movetime_ms` | int | no | Optional cap alongside depth |

**Dedupe:** repeat POST with same canonical inputs returns existing open `job_id` (`dedupe_hit: true`).

**Response:**

```json
{ "job_id": "uuid", "dedupe_hit": false }
```

### GET `/engine/jobs/{job_id}`

**Response:** `JobStatusResponse` — `status`, `fen`, `payload`, `result` (when available), `attempts`, timestamps.

Terminal statuses: `done`, `failed`, `cancelled`.

### GET `/engine/jobs/{job_id}/events` (SSE)

`Content-Type: text/event-stream`

1. First `data:` line = full snapshot from `engine:job:{id}` hash.
2. Further `data:` lines after worker **PUBLISH** on `engine:events:{id}` (API re-reads hash).

Each event JSON:

```json
{
  "job_id": "uuid",
  "fen": "...",
  "status": "queued | running | done | failed | cancelled",
  "result": {
    "depth": 12,
    "lines": [{ "uci_pv": ["e2e4"], "score_cp": 36, "score_mate": null }],
    "bestmove_uci": "e2e4"
  },
  "error": null,
  "updated_at": "ISO8601"
}
```

**Client rules:** include `fen` + `job_id` on every event; **ignore stale events** when `fen` ≠ current board position.

Nimbus: `rn-eventsource` with `Authorization` header; falls back to polling `GET /engine/jobs/{id}` if SSE fails.

### POST `/engine/jobs/{job_id}/cancel`

**Response:** `{ "job_id": "...", "cancel_requested": true }`

---

## LLM service (port 8001)

Separate process — not mounted on Board-Backend.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/parse-move` | Voice/text → SAN |
| POST | `/chat` | Coaching chat |
| POST | `/analyze-chess` | LLM position commentary (not Stockfish) |
| GET | `/models` | Available models |

Configure Nimbus `LLM_SERVICE_URL` or derive from `BASE_URL` (port 8001).

---

## HTTP errors (engine)

| Code | When |
|------|------|
| 401 | Missing/invalid JWT |
| 404 | Unknown `job_id`; archived game not found or not yours |
| 422 | Illegal FEN; invalid ply; `depth` out of range; fen + game_id both sent |
| 503 | `redis_engine` not connected |
