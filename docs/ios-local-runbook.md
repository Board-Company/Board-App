# Run the full local stack on iOS

Run performed September 11, 2026, from `/Users/tarunjassi/Board-App`.

## Prerequisites and configuration

- Xcode and the iOS 26.4 Simulator runtime are installed.
- Node, CocoaPods, Docker Desktop, `nimbus/node_modules`, and iOS Pods were already installed. No dependency reinstall was needed for the successful iOS build.
- Existing `nimbus/.env` points to `BASE_URL=http://127.0.0.1:8000/` and `LLM_SERVICE_URL=http://127.0.0.1:8001/`. These addresses work in the iOS Simulator. No environment files were changed.
- Backend credentials remain in `Board-Backend/.env`; Docker injects them without copying them into its image.
- `Board-LLM/.env` is empty. AI coaching needs a valid Hugging Face token, a supported model, and a working inference endpoint.

## Startup steps

From the repository root:

```bash
open -a Docker
open -a Simulator
xcrun simctl list devices available
./scripts/docker-stack.sh up
```

The stack script builds and starts Redis, the FastAPI backend (including Stockfish), and the LLM service. API ports bind to localhost. Redis is internal to the Docker network.

During this run, the base image registry lookup was slow. Existing local images were started while the rebuild progressed. The running backend and LLM entrypoints and dependency lockfiles matched the workspace by SHA-256. The redundant rebuild was then cancelled; the existing containers remain running:

```bash
docker compose -f docker/stack.yml up -d --no-build
```

In a separate terminal, start Metro:

```bash
cd /Users/tarunjassi/Board-App/nimbus
npx react-native start --reset-cache
```

In another terminal, build, install, and launch iOS:

```bash
cd /Users/tarunjassi/Board-App/nimbus
npx react-native run-ios --simulator 'iPhone 17 Pro' --no-packager
```

The CLI reported `Successfully launched the app` for `com.board.nimbus`. Simulator UUID: `2AC0119F-96A6-4257-BE06-5FE5846F4538`.

## Verification

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8081/status
docker compose -f docker/stack.yml exec -T redis redis-cli ping
```

Observed responses:

- Backend: `{"status":"healthy","redis":true}`.
- LLM: `{"status":"healthy","model_loaded":true,"version":"0.1.0"}`. This only initializes a client; it does not prove inference works.
- Metro: `packager-status:running`.
- Redis: `PONG`.
- Stockfish: successfully analysed the initial chess position using python-chess inside the backend container (0.1-second search).
- Real `/chat` request: failed with HTTP 500; `api-inference.huggingface.co` could not resolve. Coaching is not verified working.

Computer Use permissions were unavailable, so interactive screen testing was not possible. Native launch succeeded and Metro reported a connection from `com.board.nimbus` on `iPhone 17 Pro` after bundling `index.js`. Authenticated login, online games, voice input, and physical hardware were not exercised.

A read-only Supabase users-table probe was rejected by automatic approval review because access to private user data exceeded local startup authorization. No query ran; database-backed features remain unverified.

## Logs and shutdown

Logs from this run:

- `/tmp/board-stack-start.log`
- `/tmp/board-ios-build.log`
- `/tmp/board-metro.log`

View container status and logs:

```bash
./scripts/docker-stack.sh ps
docker compose -f docker/stack.yml logs --tail 100
```

Stop Metro with Ctrl+C in its terminal. Stop the Docker stack without deleting persisted Redis data:

```bash
./scripts/docker-stack.sh down
```

Quit Simulator when finished. For a physical iPhone, use the Mac's LAN address in the mobile environment and start the stack with `--public`; the localhost configuration above is for the Simulator.
