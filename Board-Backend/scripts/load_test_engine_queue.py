#!/usr/bin/env python3
"""Load-test the Stockfish engine job queue.

Enqueues N unique analysis jobs, spawns W worker processes, and measures wall time
until all jobs reach a terminal status.

Example:
  cd Board-Backend
  poetry run python scripts/load_test_engine_queue.py --jobs 12 --depth 10
  poetry run python scripts/load_test_engine_queue.py --jobs 12 --depth 10 --workers 1 4
"""
from __future__ import annotations

import argparse
import os
import random
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import chess
import redis

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.config import default_redis_engine_url  # noqa: E402
from engine.jobs import create_and_enqueue, get_job  # noqa: E402
from engine.keys import TERMINAL_STATUSES  # noqa: E402


@dataclass
class TrialResult:
    workers: int
    job_count: int
    depth: int
    elapsed_sec: float
    done: int
    failed: int
    pending: int
    job_ids: list[str]
    engine_cpu_sec: float

    @property
    def throughput(self) -> float:
        return self.done / self.elapsed_sec if self.elapsed_sec > 0 else 0.0


def _resolve_stockfish() -> str:
    path = os.getenv("STOCKFISH_PATH")
    if path and (os.path.isfile(path) or shutil.which(path)):
        return path
    found = shutil.which("stockfish")
    if found:
        return found
    raise SystemExit("Stockfish not found — install stockfish or set STOCKFISH_PATH")


def flush_engine_redis(r: redis.Redis) -> int:
    keys = list(r.scan_iter("engine:*"))
    if keys:
        r.delete(*keys)
    return len(keys)


def unique_fens(count: int, *, seed: int = 42) -> list[str]:
    rng = random.Random(seed)
    fens: set[str] = set()
    while len(fens) < count:
        board = chess.Board()
        plies = rng.randint(0, 20)
        for _ in range(plies):
            moves = list(board.legal_moves)
            if not moves:
                break
            board.push(rng.choice(moves))
        fens.add(board.fen())
    return list(fens)


def enqueue_jobs(
    r: redis.Redis,
    fens: list[str],
    *,
    depth: int,
    profile: str,
) -> list[str]:
    job_ids: list[str] = []
    for fen in fens:
        job_id, _ = create_and_enqueue(
            r,
            fen=fen,
            depth=depth,
            profile=profile,
            multipv=1,
        )
        job_ids.append(job_id)
    return job_ids


def wait_for_jobs(
    r: redis.Redis,
    job_ids: list[str],
    *,
    timeout_sec: float,
    poll_sec: float = 0.1,
) -> tuple[int, int, int]:
    pending = set(job_ids)
    done = 0
    failed = 0
    deadline = time.perf_counter() + timeout_sec

    while pending and time.perf_counter() < deadline:
        finished: list[str] = []
        for job_id in pending:
            record = get_job(r, job_id)
            if record is None or record.status not in TERMINAL_STATUSES:
                continue
            finished.append(job_id)
            if record.status == "done":
                done += 1
            else:
                failed += 1
        for job_id in finished:
            pending.discard(job_id)
        if pending:
            time.sleep(poll_sec)

    return done, failed, len(pending)


def spawn_workers(count: int, *, redis_url: str, stockfish_path: str) -> list[subprocess.Popen]:
    env = os.environ.copy()
    env["REDIS_ENGINE_URL"] = redis_url
    env["STOCKFISH_PATH"] = stockfish_path
    env.setdefault("STOCKFISH_THREADS", "1")
    env.setdefault("STOCKFISH_HASH_MB", "64")

    procs: list[subprocess.Popen] = []
    for _ in range(count):
        proc = subprocess.Popen(
            [sys.executable, "-m", "engine_worker"],
            cwd=ROOT,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        procs.append(proc)
    return procs


def stop_workers(procs: list[subprocess.Popen], *, grace_sec: float = 3.0) -> None:
    for proc in procs:
        if proc.poll() is None:
            proc.terminate()
    deadline = time.time() + grace_sec
    for proc in procs:
        if proc.poll() is not None:
            continue
        remaining = max(0.0, deadline - time.time())
        try:
            proc.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=2)


def _existing_worker_pids() -> list[int]:
    try:
        out = subprocess.check_output(["pgrep", "-f", "engine_worker"], text=True)
    except subprocess.CalledProcessError:
        return []
    return [int(line.strip()) for line in out.splitlines() if line.strip()]


def run_trial(
    *,
    workers: int,
    job_count: int,
    depth: int,
    profile: str,
    redis_url: str,
    stockfish_path: str,
    timeout_sec: float,
    seed: int,
    stop_existing_workers: bool,
) -> TrialResult:
    if stop_existing_workers:
        for pid in _existing_worker_pids():
            if pid == os.getpid():
                continue
            try:
                os.kill(pid, 15)
            except ProcessLookupError:
                pass
        time.sleep(0.5)

    competing = _existing_worker_pids()
    if competing:
        print(
            f"  warning: {len(competing)} other engine_worker process(es) may affect timing",
            file=sys.stderr,
        )

    r = redis.from_url(redis_url, decode_responses=True)
    r.ping()

    cleared = flush_engine_redis(r)
    fens = unique_fens(job_count, seed=seed)

    procs = spawn_workers(workers, redis_url=redis_url, stockfish_path=stockfish_path)
    time.sleep(0.75)

    started = time.perf_counter()
    job_ids = enqueue_jobs(r, fens, depth=depth, profile=profile)
    done, failed, pending = wait_for_jobs(r, job_ids, timeout_sec=timeout_sec)
    elapsed = time.perf_counter() - started

    stop_workers(procs)

    if pending:
        print(
            f"  warning: {pending} job(s) still pending after {timeout_sec:.0f}s timeout",
            file=sys.stderr,
        )

    engine_cpu_sec = _sum_engine_ms(r, job_ids) / 1000.0

    return TrialResult(
        workers=workers,
        job_count=job_count,
        depth=depth,
        elapsed_sec=elapsed,
        done=done,
        failed=failed,
        pending=pending,
        job_ids=job_ids,
        engine_cpu_sec=engine_cpu_sec,
    )


def _sum_engine_ms(r: redis.Redis, job_ids: list[str]) -> int:
    total = 0
    for job_id in job_ids:
        record = get_job(r, job_id)
        if record and record.result and record.result.engine_time_ms:
            total += record.result.engine_time_ms
    return total


def _print_result(label: str, result: TrialResult) -> None:
    print(f"\n{label}")
    print(f"  workers:     {result.workers}")
    print(f"  jobs:        {result.job_count} @ depth {result.depth}")
    print(f"  completed:   {result.done} done, {result.failed} failed, {result.pending} pending")
    print(f"  wall time:   {result.elapsed_sec:.2f}s")
    print(f"  throughput:  {result.throughput:.2f} jobs/s")
    if result.done:
        print(f"  avg/job:     {result.elapsed_sec / result.done:.2f}s")
    print(f"  engine CPU:  {result.engine_cpu_sec:.2f}s total Stockfish time across jobs")


def main() -> None:
    parser = argparse.ArgumentParser(description="Load test engine job queue throughput")
    parser.add_argument("--jobs", type=int, default=12, help="Number of jobs to enqueue")
    parser.add_argument("--depth", type=int, default=10, help="Stockfish search depth per job")
    parser.add_argument(
        "--profile",
        choices=("play", "analysis"),
        default="play",
        help="Engine profile (play uses movetime when depth omitted in prod)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        nargs="+",
        default=[1, 4],
        help="Worker counts to benchmark (default: 1 then 4)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=600.0,
        help="Max seconds to wait per trial",
    )
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for unique FENs")
    parser.add_argument(
        "--stop-existing-workers",
        action="store_true",
        help="SIGTERM other engine_worker processes before each trial",
    )
    args = parser.parse_args()

    redis_url = default_redis_engine_url()
    stockfish_path = _resolve_stockfish()

    print("Engine queue load test")
    print(f"  REDIS_ENGINE_URL: {redis_url}")
    print(f"  STOCKFISH_PATH:   {stockfish_path}")
    print(f"  jobs:             {args.jobs}")
    print(f"  depth:            {args.depth}")
    print(f"  profile:          {args.profile}")
    print(f"  worker counts:    {args.workers}")

    results: list[TrialResult] = []
    for worker_count in args.workers:
        print(f"\n--- trial: {worker_count} worker(s) ---")
        result = run_trial(
            workers=worker_count,
            job_count=args.jobs,
            depth=args.depth,
            profile=args.profile,
            redis_url=redis_url,
            stockfish_path=stockfish_path,
            timeout_sec=args.timeout,
            seed=args.seed,
            stop_existing_workers=args.stop_existing_workers,
        )
        results.append(result)
        _print_result(f"Result ({worker_count} worker(s))", result)

    if len(results) >= 2:
        baseline = results[0]
        for result in results[1:]:
            if baseline.elapsed_sec > 0 and result.elapsed_sec > 0:
                speedup = baseline.elapsed_sec / result.elapsed_sec
                saved = baseline.elapsed_sec - result.elapsed_sec
                print(
                    f"\nCompare {baseline.workers} → {result.workers} workers: "
                    f"{speedup:.2f}x faster ({saved:.2f}s saved, "
                    f"{100 * saved / baseline.elapsed_sec:.0f}% shorter)"
                )


if __name__ == "__main__":
    main()
