# Setup

Everything needed to run Board-App locally: services, environment, database, and the
mobile app. For what the system *is* and why it's built this way, see the
[README](../README.md).

## Requirements

| Tool | Version | Needed for |
|------|---------|-----------|
| Node.js | 18+ | Nimbus (React Native CLI, **not** Expo) |
| Python | 3.12+ | Backend, engine worker, LLM service |
| Poetry | latest | Python dependency management |
| Redis | 7+ | Friend games (db 0) and the engine queue (db 1) |
| Stockfish | 16+ | Engine worker only (`brew install stockfish`) |
| Xcode / Android Studio | — | Building the mobile app |
| PlatformIO | — | ESP32 firmware (optional) |

## The fast path

`Board-Backend/scripts/dev-stack.sh` brings up Redis, the API (bound to all interfaces so
a phone on the same network can reach it) and N engine workers in one command:

```bash
cd Board-Backend
./scripts/dev-stack.sh up 3      # Redis + API + 3 Stockfish workers
./scripts/dev-stack.sh status
./scripts/dev-stack.sh down
```

Then point the app at the host's LAN address (`nimbus/.env` → `BASE_URL`) and check
`http://<host>:8000/health`, which reports connectivity to both Redis databases:

```json
{"status": "healthy", "redis": true, "redis_engine": true}
```

Prefer containers? `./scripts/docker-stack.sh up` from the repo root starts Redis, the
API, 3× `engine-worker` and the LLM service — see [docker/stack.yml](../docker/stack.yml).

## Manual setup

### 1. Clone

```bash
git clone https://github.com/Board-Company/Board-App.git
cd Board-App
```

### 2. Redis

Friend games use db **0**; Stockfish jobs use db **1** on the same server. Redis must be
up before the API — without db 0, `/games/*` returns **503**; without db 1, `/engine/*`
returns **503**.

```bash
brew install redis && brew services start redis     # macOS
# or: cd Board-Backend && docker compose up -d redis
```

On startup the API connects to both databases and runs a background sweep every
`ABANDONED_GAME_SWEEP_SEC` seconds (default 300) that archives expired lobbies from
`game:shadow:{id}` into Supabase.

> **Docker on Apple Silicon shows Rosetta errors?** Run `softwareupdate --install-rosetta`
> once, then in Docker Desktop → Settings → General toggle "Use Rosetta for x86_64/amd64
> emulation". If it stays flaky, skip Docker for Redis and use Homebrew.

### 3. Backend

```bash
cd Board-Backend
cp .env.example .env          # then fill it in — see "Environment" below
python -m poetry install
poetry run python api.py
```

### 4. Stockfish engine worker

Required for live eval in friend games and depth-20 review. Run one process per
concurrent analysis you want; each worker claims one job at a time.

```bash
cd Board-Backend
export REDIS_ENGINE_URL=redis://127.0.0.1:6379/1
export STOCKFISH_PATH=$(which stockfish)
poetry run python -m engine_worker
```

### 5. LLM service (optional)

Powers the voice coach. The app runs without it; the coach screen won't.

```bash
cd Board-LLM
python -m poetry install
python -m poetry run python llm_service.py
```

### 6. Mobile app

```bash
cd nimbus
npm install --legacy-peer-deps

cd ios && pod install && cd ..   # iOS only
npx react-native run-ios
# or
npx react-native run-android
```

## Environment

### `Board-Backend/.env`

Copy [`.env.example`](../Board-Backend/.env.example) and fill in:

```bash
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...            # service_role key — keep secret
SECRET_KEY=any_long_random_string_for_jwt_signing
GOOGLE_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
REDIS_URL=redis://127.0.0.1:6379/0         # friend chess  (db 0)
REDIS_ENGINE_URL=redis://127.0.0.1:6379/1  # engine queue  (db 1)
ABANDONED_GAME_SWEEP_SEC=300
```

Worker-only variables, not read by the API: `STOCKFISH_PATH`, `STOCKFISH_HASH_MB`,
`STOCKFISH_THREADS`.

> **Never commit a real `.env`.** `.gitignore` covers `.env.*` (except `.env.example`)
> along with `*.bak`, `*.dump`, `*_backup.sql` and `backups/`. This repo previously
> leaked a database dump containing live OAuth tokens and password hashes — those
> patterns exist so it can't happen again.

### `Board-LLM/.env`

```bash
HF_API_TOKEN=your_huggingface_token
DEFAULT_MODEL=mistralai/Mistral-7B-Instruct-v0.3
```

### `nimbus/.env`

```bash
BASE_URL=http://192.168.0.208:8000        # the machine running the API
GOOGLE_WEB_CLIENT_ID=...                  # must match backend GOOGLE_CLIENT_ID
```

## Supabase

The backend uses Supabase for accounts, Lichess linking, and the archive of finished
games.

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → **New query** → run [`Board-Backend/supabase_schema.sql`](../Board-Backend/supabase_schema.sql).
   This creates `users`, `lichess_users` and `completed_games`.
3. **Project Settings → API**: copy the **Project URL** into `SUPABASE_URL` and the
   **service_role** key into `SUPABASE_KEY`. The service role bypasses Row Level
   Security, which is why the API can write `completed_games` directly — keep it secret.

`completed_games.black_player_id` must be **nullable** so lobbies that nobody joined can
be archived as `abandoned` / `expired`. If your project predates that, run
[`002_completed_games_abandoned.sql`](../Board-Backend/supabase/migrations/002_completed_games_abandoned.sql)
once; otherwise the background sweep fails on insert.

### Seeding data

[`restore_from_backup.sql`](../Board-Backend/restore_from_backup.sql) is a **template**
with placeholder rows. Fill it in locally with your own values — it is not a real dump,
and a real dump must never be committed (see the `.gitignore` note above). `hashed_password`
must be a bcrypt hash produced by the API, never a plaintext password.

## Mobile permissions

**iOS** — `Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Voice commands for chess moves</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Speech recognition for move input</string>
```

**Android** — `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## Tests

```bash
cd Board-Backend && poetry run pytest         # 32 passed
cd nimbus && npx tsc --noEmit                 # type check — clean
cd nimbus && npm run lint                     # 0 errors, ~160 style warnings
```

**On ESLint:** the project pins **ESLint 8**, not 9. `@react-native/eslint-config`
depends on `eslint-plugin-ft-flow`, which calls `context.getAllComments()` — an API
ESLint 9 removed — so linting crashes outright on 9 regardless of flat-config setup.
Moving to 9 means dropping the React Native preset (this is a TypeScript codebase, so
the Flow plugin earns nothing) and upgrading to `typescript-eslint` v8 and
`eslint-plugin-react-hooks` v5.

The remaining warnings are formatting only — `semi`, `quotes`, `no-trailing-spaces`,
`comma-dangle` — where the preset's house style differs from how the files were written.
They are left alone deliberately: `--fix` would reformat most of the app in one
unreviewable diff. Fix them per-file when you next touch a file.

## Benchmarks

Reproduce the numbers in [BENCHMARKS.md](../Board-Backend/BENCHMARKS.md):

```bash
cd Board-Backend && ./scripts/run_benchmarks.sh
```
