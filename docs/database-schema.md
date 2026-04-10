# Database schema

Living reference for **Board-Backend** persistence. Source of truth for Postgres DDL: [`Board-Backend/supabase_schema.sql`](../Board-Backend/supabase_schema.sql). Incremental SQL: [`Board-Backend/supabase/migrations/`](../Board-Backend/supabase/migrations/).

## Overview

| Layer | Technology | Code |
|-------|------------|------|
| Primary DB | Supabase (PostgreSQL) | [`Board-Backend/supabase_client.py`](../Board-Backend/supabase_client.py) — Python client; backend typically uses **service_role** (bypasses RLS). |
| ORM | None | Tables are accessed via Supabase client; **`game/models.py`** and **`schemas.py`** are Pydantic DTOs, not ORM entities. |
| Live friend chess | Redis | [`Board-Backend/game/service.py`](../Board-Backend/game/service.py) — in-memory game state and invites; archived to Postgres when the game ends. |
| Engine (Stockfish) | **No DB / no Redis (MVP)** | [`Board-Backend/engine/service.py`](../Board-Backend/engine/service.py) — stateless `POST /engine/analyse`; position in request, JSON out. Binary: **`STOCKFISH_PATH`** or `stockfish` on **`PATH`**. |

App startup **requires Redis** (ping in [`Board-Backend/api.py`](../Board-Backend/api.py) lifespan). `GET /health` reports Redis reachability only (it does **not** report Stockfish availability; use `POST /engine/analyse` or logs for engine config).

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

**Pub/sub (not a key):** channel `game:events:{game_id}` — JSON payload is the same shape as `GET /games/{game_id}`; emitted on create/join/move/resign for SSE subscribers ([`game/realtime.py`](../Board-Backend/game/realtime.py)).

On terminal outcome, service upserts **`completed_games`** then removes the game (and invite) keys.

---

## Engine (Stockfish) — MVP vs future Redis

**Shipped today:** There are **no** Postgres tables and **no** Redis keys for the engine. Analysis is **stateless**: client sends FEN + search options, API returns eval and PVs. Operational config only: **`STOCKFISH_PATH`** (optional) and **`PATH`** (fallback `which stockfish`). See [`Board-Backend/engine/service.py`](../Board-Backend/engine/service.py) and [api-routes.md](api-routes.md) (`POST /engine/analyse`).

**Not in this keyspace yet:** A **queued / live-analysis** design may add **`engine:*`** keys (queues, job hashes, pub/sub channels) and optionally **`REDIS_ENGINE_URL`** (e.g. Redis logical DB **1** while friend games stay on **0**). That layout is specified in [`plans/stockfish-queue-live-analysis.plan.md`](plans/stockfish-queue-live-analysis.plan.md). **Do not** document concrete `engine:*` TTLs or channels in this file until that code ships (or the maintainer agrees the contract); avoid colliding with `game:*`, `invite:*`, and `lock:game:*`.

---

_Last updated: 2026-04-09_
