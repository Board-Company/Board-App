# Database schema

Living reference for **Board-Backend** persistence. Source of truth for Postgres DDL: [`Board-Backend/supabase_schema.sql`](../Board-Backend/supabase_schema.sql). Incremental SQL: [`Board-Backend/supabase/migrations/`](../Board-Backend/supabase/migrations/).

## Overview

| Layer | Technology | Code |
|-------|------------|------|
| Primary DB | Supabase (PostgreSQL) | [`Board-Backend/supabase_client.py`](../Board-Backend/supabase_client.py) — Python client; backend typically uses **service_role** (bypasses RLS). |
| ORM | None | Tables are accessed via Supabase client; **`game/models.py`** and **`schemas.py`** are Pydantic DTOs, not ORM entities. |
| Live friend chess | Redis | [`Board-Backend/game/service.py`](../Board-Backend/game/service.py) — in-memory game state and invites; archived to Postgres when the game ends. |
| Engine (Stockfish) | **Redis db 1** (`REDIS_ENGINE_URL`), no Postgres | Jobs are enqueued by [`engine/routes.py`](../Board-Backend/engine/routes.py) and run in separate [`engine_worker/`](../Board-Backend/engine_worker/) processes; [`engine/service.py`](../Board-Backend/engine/service.py) holds the UCI helpers the worker uses. Binary: **`STOCKFISH_PATH`** or `stockfish` on **`PATH`**. See the [engine keyspace](#engine-stockfish--redis-job-queue) below. |

App startup **requires Redis** (ping in [`Board-Backend/api.py`](../Board-Backend/api.py) lifespan). `GET /health` reports reachability of **both** Redis databases — `{"status":"healthy","redis":true,"redis_engine":true}` — and does **not** report Stockfish availability; check worker logs for engine config.

---

## PostgreSQL tables

### `public.users`

App accounts (email/password, Google, optional Lichess link metadata).

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK, `default gen_random_uuid()` |
| `username` | `text` | NOT NULL, UNIQUE |
| `email` | `text` | UNIQUE |
| `hashed_password` | `text` | Nullable (e.g. Google-only users still get a random hash in code) |
| `disabled` | `boolean` | NOT NULL, default false |
| `picture` | `text` | |
| `auth_provider` | `text` | |
| `lichess_username` | `text` | |
| `lichess_linked` | `boolean` | Default false |
| `lichess_rating` | `jsonb` | |
| `created_at` / `updated_at` | `timestamptz` | |

Indexes: `idx_users_email`, `idx_users_lichess_username`.

### `public.lichess_users`

Lichess OAuth token storage (per Lichess username).

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `username` | `text` | NOT NULL, UNIQUE |
| `access_token` | `text` | |
| `created_at` / `updated_at` | `timestamptz` | |

Linking to app users is **logical** via `users.lichess_username` / `lichess_linked` — no FK to `lichess_users`.

### `public.completed_games`

Finished in-app friend games: **inserted when a Redis session ends** (checkmate, draw conditions, resign). See [`game/service.py`](../Board-Backend/game/service.py) `_archive_and_clear`.

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `game_id` | `uuid` | NOT NULL, **UNIQUE** — same logical id as the live Redis game |
| `white_player_id` | `uuid` | NOT NULL → `users(id)` |
| `black_player_id` | `uuid` | NOT NULL → `users(id)` |
| `move_history` | `jsonb` | NOT NULL, default `[]` — list of SAN moves |
| `final_fen` | `text` | NOT NULL |
| `result` | `text` | NOT NULL (e.g. `1-0`, `0-1`, `1/2-1/2`) |
| `finished_reason` | `text` | e.g. checkmate, resign, stalemate |
| `started_at` / `finished_at` | `timestamptz` | `finished_at` default `now()` |

Indexes: `idx_completed_games_white`, `idx_completed_games_black`.

API list/detail use Supabase nested selects on FKs `completed_games_white_player_id_fkey` / `completed_games_black_player_id_fkey` to expose `username` as white/black display names ([`game/routes.py`](../Board-Backend/game/routes.py)).

---

## Redis (friend chess)

Configured via **`REDIS_URL`** (default `redis://127.0.0.1:6379/0`). Values are JSON strings (`decode_responses=True`).

| Key pattern | Purpose | TTL |
|-------------|---------|-----|
| `game:{game_id}` | Full [`FriendGameState`](../Board-Backend/game/models.py) document (FEN, moves, players, status, etc.) | 48h (`TTL_SEC`) |
| `invite:{code}` | Maps invite code → `game_id` | Same as game |
| `lock:game:{game_id}` | Concurrency lock for mutations | 5s (`LOCK_TTL_SEC`); released with **GET + conditional DELETE** (no Lua; compatible with fakeredis in tests) |
| `game:spectators:{game_id}` | **Set** of user ids admitted as viewers via `POST /games/watch`. Membership is what lets a non-player read state or open the SSE stream | 48h (`TTL_SEC`), refreshed on each watch; deleted on archive |

**Pub/sub (not a key):** channel `game:events:{game_id}` — JSON payload is the same shape as `GET /games/{game_id}`; emitted on create/join/move/resign for SSE subscribers ([`game/realtime.py`](../Board-Backend/game/realtime.py)).

On terminal outcome, service upserts **`completed_games`** then removes the game (and invite) keys.

---

## Engine (Stockfish) — Redis job queue

Configured via **`REDIS_ENGINE_URL`** (default: db **1** on the same host as `REDIS_URL`).
No Postgres tables — engine state is entirely in Redis. Key names live in
[`Board-Backend/engine/keys.py`](../Board-Backend/engine/keys.py); tuning in
[`engine/config.py`](../Board-Backend/engine/config.py).

| Key pattern | Type | Purpose | TTL |
|---|---|---|---|
| `engine:queue:ready` | list | Jobs waiting to be claimed. Workers block on `BRPOPLPUSH` into the processing list | — |
| `engine:queue:processing` | list | Jobs claimed by a worker. A job is never in flight without being recorded here | — |
| `engine:job:{job_id}` | hash | Job document: position, options, status, attempts, result | 24h once terminal (`ENGINE_JOB_TERMINAL_TTL_SEC`) |
| `engine:dedupe:{hash}` | string | Maps an identical analysis request → existing `job_id`, so both players share one job. Claimed atomically with `SET NX` | 24h (`ENGINE_DEDUPE_TTL_SEC`) |
| `engine:idempo:{key}` | string | `Idempotency-Key` header → `job_id` | 24h (`ENGINE_DEDUPE_TTL_SEC`) |
| `engine:dead:{job_id}` | — | Dead letter after `ENGINE_MAX_ATTEMPTS` (default 3) failures | — |

**Pub/sub (not a key):** channel `engine:events:{job_id}` — progress and final eval for SSE
subscribers, throttled to `ENGINE_PUBSUB_THROTTLE_PER_SEC` (default 10) messages/sec.

**Reclaim:** a job whose worker dies stays in `engine:queue:processing`. After
`ENGINE_VISIBILITY_TIMEOUT_SEC` (default 120) a reclaimer returns it to `engine:queue:ready`
and increments its attempt count. Measured behaviour: 12 worker `SIGKILL`s during 300 jobs
lost none — see [BENCHMARKS.md](../Board-Backend/BENCHMARKS.md).

**Search cap:** `ENGINE_MAX_DEPTH` (default 30) bounds requested depth.

---

_Last updated: 2026-09-21_
