#!/usr/bin/env bash
# Run the Board-Backend benchmark suite on one machine against local Redis.
#
#   scripts/run_benchmarks.sh <out_dir> [suite ...]
#
# Suites (default: all, in this order):
#   race        G4  concurrent identical moves on one game
#   games       G1/G2  move latency + opponent delivery at rising concurrency
#   eval-games  A2/A4  games with live eval from both players (3 workers)
#   eval-rate   A3  open-loop eval requests at rising rates (3 workers)
#   streams     G3  idle SSE streams held open while games are played
#   chaos       A5  SIGKILL workers during a batch; count lost jobs
#   soak        G5  steady game load for SOAK_SEC, Redis before/after
#
# Needs: redis-server on 127.0.0.1:6379, stockfish on PATH, .venv with deps.
# Uses Redis db 10 (games) and 11 (engine) and FLUSHES both.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=${1:?usage: run_benchmarks.sh <out_dir> [suite ...]}
shift || true
SUITES=${*:-race games eval-games eval-rate streams chaos soak}
PY=.venv/bin/python
PORT=${PORT:-8100}
WORKERS=${WORKERS:-3}
SOAK_SEC=${SOAK_SEC:-600}
export STOCKFISH_PATH=${STOCKFISH_PATH:-$(command -v stockfish)}
export REDIS_URL=redis://127.0.0.1:6379/10
export REDIS_ENGINE_URL=redis://127.0.0.1:6379/11
RESULTS="$OUT/results.jsonl"
mkdir -p "$OUT"

maxfiles=$(sysctl -n kern.maxfilesperproc 2>/dev/null || echo 65536)
ulimit -n "$(( maxfiles < 65536 ? maxfiles : 65536 ))" || true

API_PID=""
WORKER_PIDS=()

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$OUT/run.log"; }

stop_all() {
  [ ${#WORKER_PIDS[@]} -gt 0 ] && kill "${WORKER_PIDS[@]}" 2>/dev/null || true
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  WORKER_PIDS=(); API_PID=""
}
trap stop_all EXIT

fresh_redis() { redis-cli -n 10 flushdb >/dev/null; redis-cli -n 11 flushdb >/dev/null; }

start_api() {
  local workers=${1:-1}
  $PY scripts/bench_app.py --port "$PORT" --workers "$workers" >>"$OUT/api.log" 2>&1 &
  API_PID=$!
  for _ in $(seq 100); do curl -sf "localhost:$PORT/health" >/dev/null && return; sleep 0.2; done
  log "API failed to start"; exit 1
}

start_workers() {
  local n=$1
  for _ in $(seq "$n"); do
    $PY -m engine_worker >>"$OUT/workers.log" 2>&1 &
    WORKER_PIDS+=($!)
  done
  for _ in $(seq 300); do
    [ "$(redis-cli client list | grep -c 'cmd=brpoplpush')" -ge "$n" ] && return
    sleep 0.1
  done
  log "workers failed to start"; exit 1
}

live() { $PY scripts/bench_live.py "$@" --base "http://127.0.0.1:$PORT" --api-pid "$API_PID" --out "$RESULTS" >/dev/null; }

log "machine: $(sysctl -n machdep.cpu.brand_string) $(sysctl -n hw.ncpu) cores $(( $(sysctl -n hw.memsize) / 1073741824 ))GB, $(redis-server --version | cut -d' ' -f3), $($STOCKFISH_PATH <<<quit | head -1)"
log "suites: $SUITES"

for suite in $SUITES; do
  fresh_redis
  case $suite in
    race)
      start_api
      log "race: 100 rounds x 20 concurrent identical moves"
      live race --rounds 100 --concurrency 20 --label race
      ;;
    games)
      # 1 API process = the production Dockerfile. 4 = horizontal scaling on one box.
      for api_workers in 1 4; do
        start_api "$api_workers"
        for slots in 50 100 200 400; do
          log "games: $slots concurrent games, 60s, 500ms think, API workers $api_workers"
          live games --slots "$slots" --duration 60 --think-ms 500 --procs 4 \
            --label "games-$slots-api$api_workers"
          fresh_redis
        done
        stop_all
      done
      ;;
    eval-games)
      start_api; start_workers "$WORKERS"
      for slots in 10 25 50; do
        log "eval-games: $slots games with live eval (depth 12), $WORKERS workers"
        live games --slots "$slots" --duration 60 --think-ms 1000 --eval --eval-depth 12 --procs 2 --label "eval-games-$slots-w$WORKERS${LABEL_SUFFIX:-}"
      done
      ;;
    eval-rate)
      start_api; start_workers "$WORKERS"
      for rate in 10 20 40 60 80; do
        log "eval-rate: $rate req/s for 30s, depth 12, $WORKERS workers"
        live eval --rate "$rate" --duration 30 --eval-depth 12 --label "eval-rate-$rate-w$WORKERS"
        sleep 5
      done
      ;;
    streams)
      start_api
      for idle in 1000 3000 6000; do  # each idle stream uses 2 local ports (client->API, API->Redis) of ~16k
        log "streams: hold $idle idle streams, play 20 games"
        live streams --idle "$idle" --sample-games 20 --moves 20 --think-ms 300 --label "streams-$idle"
        fresh_redis
      done
      ;;
    chaos)
      log "chaos: 400 jobs, depth 12, $WORKERS workers, SIGKILL every 3s, visibility 20s"
      $PY scripts/bench_chaos.py --jobs 400 --depth 12 --workers "$WORKERS" --kill-every 3 \
        --visibility 20 --out "$RESULTS" >/dev/null
      ;;
    soak)
      start_api; start_workers "$WORKERS"
      log "soak: 60 games with live eval for ${SOAK_SEC}s"
      live games --slots 60 --duration "$SOAK_SEC" --think-ms 1500 --eval --eval-depth 10 --procs 2 \
        --cooldown 30 --label "soak-${SOAK_SEC}s"
      ;;
    *) log "unknown suite $suite"; exit 1 ;;
  esac
  stop_all
  log "done: $suite"
done
log "all done -> $RESULTS"
