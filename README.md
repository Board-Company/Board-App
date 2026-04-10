# Board-App — Smart Chess Ecosystem

![Version](https://img.shields.io/badge/Version-0.1.0-blue)
![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-green)

Full-stack chess product spanning **mobile (React Native)**, **Python APIs (FastAPI)**, **LLM-assisted coaching**, **Redis-backed live play** (keyed game state plus **pub/sub → Server-Sent Events**), **Supabase (Postgres)**, **Stockfish analysis** (in-process API today; **Redis-queued workers** specified for scale-out live analysis), and **ESP32 firmware** for a physical board prototype.

---

## Why this repo exists

Board-App is a portfolio-grade monorepo that shows end-to-end ownership: native mobile UX, auth and OAuth flows, real-time game state, archival persistence, optional Docker-based local stacks, and embedded sensing for hardware. It is designed to read well on GitHub: clear layout, deep links into [`docs/`](docs/README.md), and honest boundaries (what is production-ready vs. prototype).

### Highlights for reviewers

| Area | What to look at |
|------|------------------|
| Mobile | [`nimbus/`](nimbus/) — Tamagui UI, Lichess integration, voice-driven coach screen, friend games with resume + deep links |
| Backend | [`Board-Backend/`](Board-Backend/) — JWT + Google + Lichess OAuth; friend `/games` REST with **Redis `PUBLISH` on `game:events:{id}`** and **SSE** subscribers; **`POST /engine/analyse`** (Stockfish in the API process when configured); **queued engine workers** (Redis LIST + job hashes + optional `engine:events:*` notify) per [`docs/plans/stockfish-queue-live-analysis.plan.md`](docs/plans/stockfish-queue-live-analysis.plan.md); archive finished games to Postgres |
| LLM service | [`Board-LLM/`](Board-LLM/) — FastAPI service for chat, move parsing, and position analysis (Hugging Face models) |
| Firmware | [`Board-Firmware/`](Board-Firmware/) — PlatformIO / ESP32, multiplexed hall sensors, serial bridge to the app |
| Ops / local dev | [`docker/stack.yml`](docker/stack.yml), [`scripts/docker-stack.sh`](scripts/docker-stack.sh) — Redis + API + LLM without manual wiring |

---

## Features (product)

- **Voice-controlled moves** — Natural language (“Knight to f3”, “Castle kingside”) validated against the current position.
- **AI chess coach** — Chat, analysis, openings, and strategy guidance backed by an LLM service.
- **Online play** — Lichess OAuth and in-app flows for remote play.
- **Friend games** — Create/join with invites; authoritative state in **Redis** (`game:*`, `invite:*`); each change **publishes** full game JSON to **`game:events:{game_id}`**; clients open **`GET /games/{id}/events`** (SSE) so the API **subscribes** to that channel and streams updates; finished games **archived to Supabase**.
- **Engine analysis** — **`POST /engine/analyse`** runs **Stockfish inside the API** (optional binary). A **separate worker + Redis queues** design (ready/processing lists, per-job hashes, reclaim, SSE-friendly pub/sub) is laid out for heavier or live-eval workloads — see [`docs/plans/stockfish-queue-live-analysis.plan.md`](docs/plans/stockfish-queue-live-analysis.plan.md).
- **Puzzles, bots, local play** — Training and offline-style modes in the mobile app.
- **Smart board (prototype)** — Hall-effect sensing, multiplexer readout, noise handling, and firmware documented under `Board-Firmware/`.

---

## Architecture

Services are decoupled so each piece can be demonstrated or extended independently. Typical local ports: **API 8000**, **LLM 8001**, **Redis** (Compose internal unless you publish it).

**Friend games (live):** REST handlers update Redis documents and call **`publish_friend_game_state`** → channel **`game:events:{game_id}`**. The SSE route subscribes to that channel and forwards each message as an SSE `data:` frame (see [`Board-Backend/game/realtime.py`](Board-Backend/game/realtime.py), [`Board-Backend/game/routes.py`](Board-Backend/game/routes.py)).

**Stockfish:** **Shipped path** — `POST /engine/analyse` with **`asyncio.to_thread`** and a process-local UCI engine ([`Board-Backend/engine/`](Board-Backend/engine/)). **Target path (plan)** — API **enqueues** `job_id` on Redis lists and reads job hashes; one or more **worker processes** claim jobs, run Stockfish, write results back, and may **publish** incremental updates for job-scoped SSE ([`docs/plans/stockfish-queue-live-analysis.plan.md`](docs/plans/stockfish-queue-live-analysis.plan.md)).

```mermaid
flowchart TB
  subgraph mobile["Nimbus (React Native)"]
    App[App + screens]
  end
  subgraph cloud["Your machine / cloud"]
    API[Board-Backend FastAPI]
    LLM[Board-LLM FastAPI]
    subgraph redis["Redis"]
      direction TB
      GK["Keys: game:* · invite:* · lock:*"]
      GCH["Pub/Sub: game:events:game_id"]
      EQ["Lists: engine:queue:* planned"]
      EJ["Hash: engine:job:job_id planned"]
      ECH["Pub/Sub: engine:events:job_id planned"]
    end
    DB[(Supabase Postgres)]
  end
  subgraph edge["Hardware (optional)"]
    FW[ESP32 firmware]
  end
  SF[(Stockfish binary)]
  subgraph workers["Engine workers (planned)"]
    EW[Worker process(es)]
  end
  App -->|REST JWT /games| API
  App -->|SSE GET /games/id/events| API
  App -->|REST coach| LLM
  App -->|POST /engine/analyse today| API
  API -->|read/write state · PUBLISH moves| GK
  API -->|SUBSCRIBE · stream to client| GCH
  API -->|archive terminal games| DB
  App -.->|serial / future bridge| FW
  API -.->|enqueue LPUSH · GET job · SSE planned| EQ
  API -.->|job snapshot + notify planned| EJ
  API -.->|subscribe planned| ECH
  EW -.->|BRPOPLPUSH claim · LREM ack| EQ
  EW -.->|HSET results planned| EJ
  EW -.->|optional PUBLISH partials| ECH
  EW -.->|UCI| SF
  API -->|to_thread UCI · today| SF
```

**Deeper behavior** (friend game lifecycle, SSE, client resume): [`docs/complex-logic.md`](docs/complex-logic.md). **HTTP surface**: [`docs/api-routes.md`](docs/api-routes.md). **Tables and Redis patterns**: [`docs/database-schema.md`](docs/database-schema.md).

---

## Repository layout

| Path | Purpose |
|------|---------|
| [`nimbus/`](nimbus/) | React Native app (CLI, not Expo) |
| [`Board-Backend/`](Board-Backend/) | FastAPI API, auth, games, health |
| [`Board-LLM/`](Board-LLM/) | Chess coach LLM microservice |
| [`Board-Firmware/`](Board-Firmware/) | ESP32 / PlatformIO firmware |
| [`docs/`](docs/README.md) | Knowledge base + link to [`docs/plans/`](docs/plans/) |
| [`tools/hardware-sim/`](tools/hardware-sim/) | Optional Python scripts for sensor / magnet visualization |
| [`scripts/`](scripts/) | Install helpers, Terminal layouts, full stack runner, Docker driver |
| [`docker/stack.yml`](docker/stack.yml) | Compose: Redis + backend + LLM (`scripts/docker-stack.sh`) |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native CLI, TypeScript, Tamagui, React Navigation, chess.js |
| Backend | Python 3.12+, FastAPI, Supabase client, Redis, SSE (`text/event-stream`) |
| LLM | Python, FastAPI, Hugging Face inference |
| Firmware | C++, PlatformIO, ESP32 |
| Voice | `@react-native-voice/voice` (see mobile README for permissions) |
| Auth | JWT, Google Sign-In, Lichess OAuth2 (PKCE) |

---

## Requirements

- **Node.js** v18+ — [nodejs.org](https://nodejs.org/)
- **Python** 3.12+ and **Poetry** — [python.org](https://www.python.org/downloads/), [Poetry](https://python-poetry.org/docs/#installation)
- **React Native CLI** environment (Xcode / Android Studio, JDK, CocoaPods as needed)
- **PlatformIO** — optional, for firmware only
- **Docker** — optional, for [`scripts/docker-stack.sh`](scripts/docker-stack.sh)

---

## Quick start

### 1. Clone

```bash
git clone <your-fork-or-upstream-url>
cd Board-App
```

### 2. Backend (FastAPI)

```bash
cd Board-Backend
python -m poetry install
# Optional: server-side analysis (POST /engine/analyse) needs Stockfish on PATH or STOCKFISH_PATH in .env
# macOS: brew install stockfish
poetry run python api.py
```

Default dev URL: `http://127.0.0.1:8000` — `GET /health` should report Redis when configured. Engine analysis needs a Stockfish binary (see [docs/api-routes.md](docs/api-routes.md) and [docs/database-schema.md](docs/database-schema.md)).

### 3. LLM service

```bash
cd Board-LLM
python -m poetry install
python -m poetry run python llm_service.py
```

Default dev URL: `http://127.0.0.1:8001`.

### 4. Redis + stack (recommended)

Friend games and health checks expect Redis. Easiest path:

```bash
./scripts/docker-stack.sh up
```

See comments in [`docker/stack.yml`](docker/stack.yml) for LAN/device testing (`--public`, custom ports).

### 5. Mobile app

```bash
cd nimbus
npm install --legacy-peer-deps

# iOS (macOS)
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

**Device note:** For a phone on Wi‑Fi, point `BASE_URL` in `nimbus/.env` at your machine’s LAN IP and open firewall ports **8000** / **8001** (or terminate TLS on **443**). USB Android can use `adb reverse tcp:8000 tcp:8000` when the API binds to loopback.

More detail: [`nimbus/README.md`](nimbus/README.md).

---

## Environment variables

### Board-Backend (`Board-Backend/.env`)

Create this file locally (it is gitignored). Typical keys:

| Variable | Role |
|----------|------|
| `SUPABASE_URL` / `SUPABASE_KEY` | Postgres-backed users and archives (service role for server-side access) |
| `GOOGLE_CLIENT_ID` | Google ID token verification |
| `SECRET_KEY` | JWT signing |
| `REDIS_URL` | Live games and SSE pub/sub |
| `STOCKFISH_PATH` | Optional full path to Stockfish binary; if unset, the backend uses `stockfish` on `PATH`. Without a binary, `POST /engine/analyse` returns 503. |

### Board-LLM (`Board-LLM/.env`)

```
HF_API_TOKEN=your_huggingface_token
DEFAULT_MODEL=mistralai/Mistral-7B-Instruct-v0.3
```

### Nimbus (`nimbus/.env`)

React Native env vars are loaded via `react-native-dotenv` (see [`nimbus/src/env.ts`](nimbus/src/env.ts)): at minimum **`BASE_URL`** (Board-Backend). Optional **`LLM_SERVICE_URL`** overrides the derived LLM base URL.

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`Board-Backend/supabase_schema.sql`](Board-Backend/supabase_schema.sql) to create core tables (`users`, `lichess_users`, `completed_games`, etc.).
3. Under **Project Settings → API**, copy **Project URL** → `SUPABASE_URL`, and **service_role** key → `SUPABASE_KEY` (keep secret; backend bypasses RLS by design).
4. Set `SECRET_KEY` and start the backend as in Quick start.

Optional restore from an old backup: [`Board-Backend/restore_from_backup.sql`](Board-Backend/restore_from_backup.sql) (run after schema; tokens in backups may be expired).

---

## API overview

Authoritative tables live in [`docs/api-routes.md`](docs/api-routes.md). Short summary:

| Service | Port (local default) | Examples |
|---------|-------------------------|----------|
| Board-Backend | 8000 | `POST /token`, `GET /users/me`, `POST /games`, `GET /games/{id}/events` (SSE), `POST /engine/analyse` (Bearer) |
| Board-LLM | 8001 | `POST /parse-move`, `POST /chat`, `POST /analyze-chess`, `GET /models` |

---

## Documentation index

| Doc | Contents |
|-----|----------|
| [docs/README.md](docs/README.md) | How `docs/` is organized |
| [docs/api-routes.md](docs/api-routes.md) | HTTP routes, auth, payloads |
| [docs/database-schema.md](docs/database-schema.md) | Postgres + Redis patterns; engine MVP (no engine Redis keys) |
| [docs/complex-logic.md](docs/complex-logic.md) | Friend games, SSE, client edge cases, Stockfish off the event loop |
| [docs/plans/](docs/plans/) | Technical plans; superseded in [docs/plans/archive/](docs/plans/archive/) |

---

## Screenshots & demo (for your portfolio fork)

GitHub visitors engage with visuals. After you add assets, link them here, for example:

```markdown
## Screenshots
<p align="center">
  <img src="docs/assets/screenshot-home.png" width="280" alt="Home" />
  <img src="docs/assets/screenshot-friend-game.png" width="280" alt="Friend game" />
</p>
```

Create `docs/assets/` in your fork and keep images out of secrets (no API keys in screenshots).

---

## Hardware prototype

- **ESP32** — Sensor processing and communication.
- **Hall sensors + 16-channel mux** — Piece presence and state transitions (approaching / over / leaving).
- **Firmware** — ADC reads, filtering, multiplexer timing; see `Board-Firmware/src/`.

---

## Mobile permissions

**iOS** (`Info.plist`): `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` for voice features.

**Android** (`AndroidManifest.xml`): `RECORD_AUDIO` (and `INTERNET` as already configured).

---

## License

This project is **proprietary**. All rights reserved. For a public portfolio, replace this section in your fork if you open-source a subset under a different license.

---

## Contributing

This repository is maintained as a product monorepo. If you are the sole owner, use Issues/Projects on your fork for roadmap tracking; for external contributions, add a `CONTRIBUTING.md` when you are ready to describe PR expectations and coding standards.
