# Board-Backend benchmarks

Measurements of the live friend-game path (Redis locks, pub/sub, SSE) and the Stockfish
job queue (Redis lists, workers, SSE), with the scripts to reproduce them.

Latest run: **2026-09-13, Mac mini (Apple M4, 10 cores: 4 performance + 6 efficiency, 16 GB)**.
Raw output: [`benchmarks/2026-09-13-macmini-m4/`](benchmarks/2026-09-13-macmini-m4/).

## Headline results

| Claim | Result |
|---|---|
| Live moves reach the opponent quickly | **p95 43 ms** at 50 concurrent games, **54 ms** at 200 (1 API process, as in the Dockerfile) |
| The API scales horizontally through Redis pub/sub | At 400 games: 1 process delivered **361 moves/s, p95 1,435 ms**; 4 processes delivered **637 moves/s, p95 11 ms** |
| Simultaneous moves can't corrupt a game | 100 rounds of 20 identical concurrent moves: **exactly 1 accepted every round**, 0 bad states |
| Engine queue scales with workers | 64 depth-16 jobs: **2.93x with 3 workers, 5.2x with 8** (median of 3) |
| Live eval is fast | 3 workers sustain **60 eval requests/s** with time-to-first-eval **p95 31 ms**; saturates near 80/s |
| Dedupe shares work between players | Hit rate at 10 games **4% → 50%** after the atomic claim fix; first-eval p95 **88 → 45 ms** |
| No lost jobs when workers die | **12 SIGKILLs** during 300 jobs: **0 lost**, 11 recovered by the reclaimer, 0 dead-lettered |
| Stable under sustained load | 10-minute soak, 60 games + live eval: **24,125 moves, 48,250 evals, 0 missed or stalled**; API RSS 75 → 85 MB |

## What is and isn't being measured

- **Real:** FastAPI routes, per-game Redis lock, python-chess validation, Redis pub/sub,
  SSE streams, engine enqueue/dedupe, `BRPOPLPUSH` workers, Stockfish, reclaimer.
- **Stubbed:** Supabase (archive writes succeed instantly) and JWT user lookup
  (`Authorization: Bearer bench:<name>`). These numbers exclude Supabase latency. With
  real auth, add one Supabase round trip per user every 30 s (the auth cache TTL).
- **Redis:** 8.10.1 on the same machine, AOF on with `appendfsync everysec` (as in
  `docker/stack.yml`), db 10/11.
- **Load generator on the same machine** as the API, Redis and workers. Its CPU is
  sampled and reported in the raw results; the numbers are conservative.
- **Background load:** a UTM virtual machine used about one core throughout.

## Results

### Live games (G1, G2): 60 s per row, 500 ms between moves, 4 load-generator processes

| API processes | Games | Moves/s | Move POST p50 / p95 / p99 ms | Opponent delivery p50 / p95 / p99 ms | Missed |
|---|---|---|---|---|---|
| 1 | 50 | 81.6 | 18.0 / 51.9 / 59.7 | 14.2 / 43.4 / 50.0 | 0 |
| 1 | 100 | 162.9 | 22.7 / 67.3 / 85.8 | 17.2 / 55.5 / 74.5 | 0 |
| 1 | 200 | 314.4 | 10.2 / 66.6 / 106.8 | 7.5 / 54.1 / 88.3 | 0 |
| 1 | 400 | 360.9 | 101.0 / 1491.8 / 2779.4 | 76.7 / 1434.5 / 2719.1 | 0 |
| 4 | 50 | 83.9 | 9.4 / 18.3 / 24.1 | 7.6 / 15.5 / 20.9 | 0 |
| 4 | 100 | 167.9 | 8.5 / 22.7 / 34.8 | 6.6 / 18.6 / 30.8 | 0 |
| 4 | 200 | 320.5 | 5.8 / 16.8 / 37.3 | 4.4 / 13.8 / 33.5 | 0 |
| 4 | 400 | 636.6 | 5.5 / 13.7 / 27.5 | 4.0 / 11.1 / 23.2 | 0 |

One process tops out around 350 moves/s. At 400 games it also dropped 2 connections
(macOS `kern.ipc.somaxconn` is 128 on this machine).

### Concurrent identical moves (G4)

100 rounds × 20 simultaneous `POST /move {"san":"e4"}` from the same player: every round
accepted exactly one (100 × 200, 871 × 409 lock busy, 1,029 × 403 not your turn), and every
final game had `move_history == ["e4"]`.

### Worker scaling (A1): 64 unique positions at depth 16, median of 3

| Workers | Jobs/s | Speedup | Efficiency | Stockfish s/job |
|---|---|---|---|---|
| 1 | 2.59 | 1.00x | 100% | 0.380 |
| 2 | 4.91 | 1.89x | 95% | 0.400 |
| 3 | 7.60 | 2.93x | 98% | 0.384 |
| 4 | 8.41 | 3.24x | 81% | 0.439 |
| 6 | 11.14 | 4.29x | 71% | 0.515 |
| 8 | 13.53 | 5.21x | 65% | 0.538 |
| 10 | 13.93 | 5.37x | 54% | 0.648 |

Past 3–4 workers, searches land on efficiency cores (and the VM's busy core); the rising
per-job Stockfish time shows it.

### Games with live eval (A2, A4): both players request depth-12 eval after every move, 3 workers

| Dedupe | Games | Eval requests | Dedupe hit rate | First eval p50 / p95 ms | Done p95 ms | Queue wait p95 ms | Stalled |
|---|---|---|---|---|---|---|---|
| before fix | 10 | 1,600 | 4% | 22.9 / 87.8 | 148.3 | 81.6 | 0 |
| after fix | 10 | 1,600 | 50% | 16.1 / 45.4 | 130.8 | 35.9 | 0 |
| before fix | 25 | 4,000 | 47% | 13.2 / 79.3 | 141.4 | 94.0 | 0 |
| after fix | 25 | 4,000 | 71% | 12.5 / 54.5 | 114.4 | 46.1 | 0 |
| before fix | 50 | 8,000 | 57% | 11.3 / 80.7 | 131.1 | 91.4 | 0 |
| after fix | 50 | 8,000 | 76% | 9.2 / 31.7 | 82.7 | 21.8 | 0 |

Above 10 games, part of the hit rate is finished results reused for common early
positions, since the random games often repeat openings.

### Eval request rate (A3): unique positions, depth 12, 3 workers, 30 s per rate

| Offered /s | Completed /s | First eval p50 / p95 / p99 ms | Queue wait p50 / p95 ms |
|---|---|---|---|
| 10 | 10.0 | 7.5 / 16.0 / 19.3 | 1.4 / 2.1 |
| 20 | 19.9 | 6.0 / 7.5 / 8.3 | 1.3 / 1.6 |
| 40 | 39.8 | 5.4 / 7.4 / 23.4 | 1.2 / 1.7 |
| 60 | 60.0 | 5.6 / 31.0 / 66.1 | 1.2 / 26.3 |
| 80 | 79.2 | 45.4 / 196.8 / 306.4 | 40.9 / 192.2 |

### Idle streams (G3): hold N open, play 20 games, measure delivery

| Idle streams | Delivery p50 / p95 ms | Redis clients | API RSS MB |
|---|---|---|---|
| 998 | 15.3 / 80.6 | 1,007 | 115.6 |
| 2,990 | 11.2 / 90.1 | 3,001 | 203.4 |
| 5,898 | 80.1 / 425.7 | 5,940 | 327.7 |

About 40 KB of API memory and one Redis connection per open stream. At 6,000 the single
load-generator process for this test was near 100% CPU and about 1% of stream opens
failed, so treat that row as a lower bound. Each stream uses two local ports (client → API,
API → Redis) of macOS's ~16k, which caps this test on one machine.

### Worker crashes (A5): 300 jobs at depth 16, 3 workers, SIGKILL a random worker every 3 s

12 kills; 300/300 done; **0 lost**; 11 jobs recovered by the reclaimer (max 2 attempts);
0 dead-letter keys; ready/processing lists empty; no orphaned Stockfish. Visibility
timeout was lowered to 20 s for the test (default 120 s). The first chaos row in
`results.jsonl` (400 jobs at depth 12, 1 kill) finished too quickly to be a real test.

### Soak (G5): 60 games with depth-10 live eval for 600 s

24,125 moves, 48,250 eval requests (52% dedupe hits), all completed; 0 missed deliveries,
0 stalled streams. API RSS 75 → 85 MB. Redis clients 6 → 43, which matches the connection
pool's peak concurrency rather than growth over time.

## Reproduce

```bash
# once: redis-server running on 127.0.0.1:6379, stockfish on PATH, poetry install
cd Board-Backend

# worker scaling
REDIS_ENGINE_URL=redis://127.0.0.1:6379/11 .venv/bin/python scripts/load_test_engine_queue.py \
  --jobs 64 --depth 16 --workers 1 2 3 4 6 8 10 --stop-existing-workers

# everything else (~45 min); flushes Redis db 10 and 11
scripts/run_benchmarks.sh results/$(date +%F) [race games eval-games eval-rate streams chaos soak]
.venv/bin/python scripts/summarize_benchmarks.py results/$(date +%F)/results.jsonl
```

macOS notes:
- **Don't background the runner from zsh with a bare `&`.** zsh's `BG_NICE` runs it at
  nice 5, which pushes the processes onto efficiency cores and inflated move latency in
  an earlier attempt. Run it in the foreground, or `setopt no_bg_nice` first.
- **Don't run from an iCloud-synced folder.** Desktop and Documents can evict files, and
  Python imports then wait on downloads.

| Script | Purpose |
|---|---|
| `scripts/bench_app.py` | Real API with Supabase and user lookup stubbed; `--workers N` |
| `scripts/bench_live.py` | Load generator: `games`, `eval`, `race`, `streams`; CPU sampling; `--procs N` |
| `scripts/bench_chaos.py` | SIGKILL workers during a batch and audit every job |
| `scripts/load_test_engine_queue.py` | Queue throughput vs worker count |
| `scripts/run_benchmarks.sh` | Runs the suites in order and writes `results.jsonl` |
| `scripts/summarize_benchmarks.py` | Markdown tables from `results.jsonl` |
