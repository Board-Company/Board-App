#!/usr/bin/env python3
"""Crash-recovery benchmark for the engine queue (A5).

Enqueues a batch of unique analysis jobs, runs W workers, and SIGKILLs a random worker
every few seconds (no cleanup, as with an OOM kill or a pulled plug), starting a
replacement each time. When the batch drains, it checks every job:

  lost      job never reached done/failed/cancelled
  retried   attempts > 0, i.e. recovered by the reclaimer after a kill
  failed    gave up after max attempts (dead-letter key written)

It also checks that the ready/processing lists end empty.

  cd Board-Backend
  .venv/bin/python scripts/bench_chaos.py --jobs 300 --depth 12 --workers 3 \
      --kill-every 5 --visibility 20
"""
from __future__ import annotations

import argparse
import json
import os
import random
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import redis

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from engine.keys import QUEUE_PROCESSING, QUEUE_READY, TERMINAL_STATUSES, job_key  # noqa: E402
from load_test_engine_queue import (  # noqa: E402
    _resolve_stockfish,
    enqueue_jobs,
    flush_engine_redis,
    spawn_workers,
    stop_workers,
    unique_fens,
)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--jobs", type=int, default=300)
    p.add_argument("--depth", type=int, default=12)
    p.add_argument("--workers", type=int, default=3)
    p.add_argument("--kill-every", type=float, default=5.0, help="Seconds between SIGKILLs")
    p.add_argument("--visibility", type=int, default=120, help="ENGINE_VISIBILITY_TIMEOUT_SEC for workers")
    p.add_argument("--timeout", type=float, default=1200.0)
    p.add_argument("--redis-url", default="redis://127.0.0.1:6379/11")
    p.add_argument("--seed", type=int, default=11)
    p.add_argument("--out")
    args = p.parse_args()

    os.environ["ENGINE_VISIBILITY_TIMEOUT_SEC"] = str(args.visibility)
    stockfish = _resolve_stockfish()
    r = redis.from_url(args.redis_url, decode_responses=True)
    r.ping()
    flush_engine_redis(r)
    rng = random.Random(args.seed)

    procs = spawn_workers(args.workers, redis_url=args.redis_url, stockfish_path=stockfish)
    time.sleep(1.0)
    job_ids = enqueue_jobs(r, unique_fens(args.jobs, seed=args.seed), depth=args.depth, profile="play")
    started = time.perf_counter()
    kills: list[float] = []
    next_kill = started + args.kill_every

    def open_jobs() -> int:
        return sum(1 for j in job_ids if r.hget(job_key(j), "status") not in TERMINAL_STATUSES)

    remaining = open_jobs()
    while remaining and time.perf_counter() - started < args.timeout:
        now = time.perf_counter()
        # Keep killing while real work is still queued; once only reclaimable jobs are
        # left, let the reclaimer finish them.
        if now >= next_kill and r.llen(QUEUE_READY) > 0:
            alive = [proc for proc in procs if proc.poll() is None]
            victim = rng.choice(alive)
            victim.send_signal(signal.SIGKILL)
            victim.wait()
            procs.remove(victim)
            procs += spawn_workers(1, redis_url=args.redis_url, stockfish_path=stockfish)
            kills.append(round(now - started, 1))
            next_kill = now + args.kill_every
        time.sleep(0.25)
        remaining = open_jobs()
    elapsed = time.perf_counter() - started
    stop_workers(procs)

    statuses: dict[str, int] = {}
    retried: list[dict] = []
    for j in job_ids:
        h = r.hgetall(job_key(j))
        st = h.get("status", "missing")
        statuses[st] = statuses.get(st, 0) + 1
        if int(h.get("attempts") or 0) > 0:
            created = datetime.fromisoformat(h["created_at"])
            updated = datetime.fromisoformat(h["updated_at"])
            retried.append({"attempts": int(h["attempts"]), "total_s": (updated - created).total_seconds()})

    lost = sum(n for st, n in statuses.items() if st not in TERMINAL_STATUSES)
    result = {
        "jobs": args.jobs,
        "depth": args.depth,
        "workers": args.workers,
        "visibility_timeout_s": args.visibility,
        "reclaim_scan_interval_s": 30,
        "kills": len(kills),
        "kill_times_s": kills,
        "elapsed_s": round(elapsed, 1),
        "statuses": statuses,
        "lost": lost,
        "retried_jobs": len(retried),
        "max_attempts_seen": max((x["attempts"] for x in retried), default=0),
        "slowest_retried_job_s": round(max((x["total_s"] for x in retried), default=0), 1),
        "ready_len_after": r.llen(QUEUE_READY),
        "processing_len_after": r.llen(QUEUE_PROCESSING),
        "dead_letter_keys": sum(1 for _ in r.scan_iter("engine:dead:*")),
        "orphan_stockfish_after": len(
            subprocess.run(["pgrep", "-x", "stockfish"], capture_output=True, text=True).stdout.split()
        ),
    }
    record = {"mode": "chaos", "at": time.strftime("%Y-%m-%dT%H:%M:%S"), "result": result}
    print(json.dumps(record, indent=2))
    if args.out:
        with open(args.out, "a") as f:
            f.write(json.dumps(record) + "\n")


if __name__ == "__main__":
    main()
