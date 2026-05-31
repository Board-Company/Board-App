"""Stockfish worker: BRPOPLPUSH claim loop + UCI analysis (sync Redis)."""
from __future__ import annotations

import os
import signal
import threading
import time

import chess.engine
import redis
from loguru import logger

from engine.config import (
    CLAIM_BLOCK_TIMEOUT_SEC,
    VISIBILITY_TIMEOUT_SEC,
    default_redis_engine_url,
)
from engine.jobs import get_job, set_job_result
from engine.queue import ack_job, claim_job, reclaim_stale_jobs, release_job_to_ready, retry_or_dlq
from engine.schemas import JobResult
from engine_worker.analyse import analyse_payload
from engine_worker.publish import ProgressPublisher


def _reclaimer_loop(r: redis.Redis, stop: threading.Event) -> None:
    while not stop.wait(timeout=30):
        try:
            n = reclaim_stale_jobs(r, visibility_timeout_sec=VISIBILITY_TIMEOUT_SEC)
            if n:
                logger.info("Reclaimed {} stale engine job(s)", n)
        except Exception:
            logger.exception("Engine reclaimer failed")


def _cancelled(r: redis.Redis, job_id: str) -> bool:
    record = get_job(r, job_id)
    return bool(record and record.cancel_requested)


def _process_job(r: redis.Redis, engine: chess.engine.SimpleEngine, job_id: str) -> None:
    record = get_job(r, job_id)
    if record is None:
        ack_job(r, job_id)
        return

    if _cancelled(r, job_id):
        cancelled = JobResult(
            job_id=job_id,
            fen=record.fen,
            status="cancelled",
            error="cancelled before analysis",
        )
        set_job_result(r, job_id, cancelled, status_value="cancelled")
        ProgressPublisher().push(r, job_id, cancelled, status_value="cancelled", force=True)
        ack_job(r, job_id)
        return

    try:
        publisher = ProgressPublisher()

        def on_progress(partial: JobResult) -> None:
            publisher.push(r, job_id, partial, status_value="running")

        result = analyse_payload(engine, record.payload, on_progress=on_progress)
        if _cancelled(r, job_id):
            set_job_result(
                r,
                job_id,
                JobResult(
                    job_id=job_id,
                    fen=record.fen,
                    status="cancelled",
                    error="cancelled during analysis",
                ),
                status_value="cancelled",
            )
            publisher.push(
                r,
                job_id,
                JobResult(
                    job_id=job_id,
                    fen=record.fen,
                    status="cancelled",
                    error="cancelled during analysis",
                ),
                status_value="cancelled",
                force=True,
            )
        else:
            set_job_result(r, job_id, result, status_value="done")
            publisher.push(r, job_id, result, status_value="done", force=True)
        ack_job(r, job_id)
    except Exception as e:
        logger.exception("Engine job {} failed", job_id)
        retry_or_dlq(r, job_id, error=str(e))


def run_worker() -> None:
    redis_url = default_redis_engine_url()
    stockfish_path = os.getenv("STOCKFISH_PATH", "/usr/games/stockfish")

    if not os.path.isfile(stockfish_path) and not _which(stockfish_path):
        logger.error("Stockfish not found at STOCKFISH_PATH={}", stockfish_path)
        raise SystemExit(1)

    r = redis.from_url(redis_url, decode_responses=True)
    r.ping()
    logger.info("Engine worker connected to Redis at {}", redis_url)

    stop = threading.Event()
    shutting_down = threading.Event()
    current_job: list[str | None] = [None]

    def _handle_sigterm(_signum, _frame) -> None:
        logger.info("Shutdown signal received — stop after current job or re-queue")
        shutting_down.set()

    signal.signal(signal.SIGTERM, _handle_sigterm)
    signal.signal(signal.SIGINT, _handle_sigterm)

    reclaimer = threading.Thread(target=_reclaimer_loop, args=(r, stop), daemon=True)
    reclaimer.start()

    engine = chess.engine.SimpleEngine.popen_uci(stockfish_path)
    hash_mb = int(os.getenv("STOCKFISH_HASH_MB", "64"))
    threads = int(os.getenv("STOCKFISH_THREADS", "1"))
    try:
        engine.configure({"Hash": hash_mb, "Threads": threads})
    except chess.engine.EngineError:
        logger.warning("Could not configure Stockfish Hash/Threads")

    logger.info("Stockfish ready at {}", stockfish_path)

    try:
        while not shutting_down.is_set():
            job_id = claim_job(r, block_timeout_sec=CLAIM_BLOCK_TIMEOUT_SEC)
            if not job_id:
                continue

            current_job[0] = job_id
            _process_job(r, engine, job_id)
            current_job[0] = None
    finally:
        stop.set()
        jid = current_job[0]
        if jid and shutting_down.is_set():
            release_job_to_ready(r, jid)
        engine.quit()
        logger.info("Engine worker stopped")


def _which(path: str) -> bool:
    for p in os.environ.get("PATH", "").split(os.pathsep):
        candidate = os.path.join(p, os.path.basename(path))
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return True
    return False


def main() -> None:
    run_worker()


if __name__ == "__main__":
    main()
