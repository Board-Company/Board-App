"""Redis LIST queue: visibility list pattern (sync — worker + tests)."""
from __future__ import annotations

import json
from datetime import datetime, timezone

import redis

from engine.config import MAX_ATTEMPTS, VISIBILITY_TIMEOUT_SEC
from engine.keys import QUEUE_PROCESSING, QUEUE_READY, dead_key, job_key
from engine.schemas import JobStatus


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def enqueue_ready(r: redis.Redis, job_id: str) -> None:
    r.lpush(QUEUE_READY, job_id)


def claim_job(r: redis.Redis, *, block_timeout_sec: int = 5) -> str | None:
    """
    BRPOPLPUSH ready → processing. Sets status=running and claimed_at on the job hash.
    Returns job_id or None on timeout.
    """
    job_id = r.brpoplpush(QUEUE_READY, QUEUE_PROCESSING, timeout=block_timeout_sec)
    if not job_id:
        return None
    now = _now_iso()
    r.hset(
        job_key(job_id),
        mapping={
            "status": "running",
            "claimed_at": now,
            "updated_at": now,
        },
    )
    return job_id


def ack_job(r: redis.Redis, job_id: str) -> int:
    """Remove job_id from processing after successful completion. Returns LREM count."""
    return r.lrem(QUEUE_PROCESSING, 1, job_id)


def release_job_to_ready(r: redis.Redis, job_id: str) -> None:
    """
    SIGTERM / worker shutdown: LREM from processing then LPUSH ready (never LPUSH without LREM).
    """
    r.lrem(QUEUE_PROCESSING, 1, job_id)
    r.hset(
        job_key(job_id),
        mapping={"status": "queued", "updated_at": _now_iso()},
    )
    r.lpush(QUEUE_READY, job_id)


def retry_or_dlq(
    r: redis.Redis,
    job_id: str,
    *,
    error: str,
    max_attempts: int = MAX_ATTEMPTS,
) -> JobStatus:
    """On worker failure: retry to ready or move to DLQ. Always LREM from processing first."""
    r.lrem(QUEUE_PROCESSING, 1, job_id)
    fields = r.hgetall(job_key(job_id))
    attempts = int(fields.get("attempts") or "0") + 1
    now = _now_iso()

    if attempts >= max_attempts:
        r.hset(
            job_key(job_id),
            mapping={
                "status": "failed",
                "attempts": str(attempts),
                "error": error[:500],
                "updated_at": now,
            },
        )
        r.set(
            dead_key(job_id),
            json.dumps({"job_id": job_id, "error": error, "attempts": attempts}),
        )
        return "failed"

    r.hset(
        job_key(job_id),
        mapping={
            "status": "queued",
            "attempts": str(attempts),
            "error": error[:500],
            "updated_at": now,
        },
    )
    r.lpush(QUEUE_READY, job_id)
    return "queued"


def reclaim_stale_jobs(
    r: redis.Redis,
    *,
    visibility_timeout_sec: int = VISIBILITY_TIMEOUT_SEC,
    max_attempts: int = MAX_ATTEMPTS,
) -> int:
    """
    Scan processing list; re-queue or DLQ jobs whose claimed_at exceeded visibility timeout
    while status is still running. Never touches Stockfish — Redis only.
    """
    now = datetime.now(timezone.utc)
    reclaimed = 0
    for job_id in r.lrange(QUEUE_PROCESSING, 0, -1):
        fields = r.hgetall(job_key(job_id))
        if not fields:
            r.lrem(QUEUE_PROCESSING, 1, job_id)
            reclaimed += 1
            continue

        status = fields.get("status")
        if status != "running":
            continue

        claimed_at_s = fields.get("claimed_at") or ""
        if not claimed_at_s:
            continue

        try:
            claimed_at = datetime.fromisoformat(claimed_at_s)
        except ValueError:
            continue

        if claimed_at.tzinfo is None:
            claimed_at = claimed_at.replace(tzinfo=timezone.utc)

        elapsed = (now - claimed_at).total_seconds()
        if elapsed <= visibility_timeout_sec:
            continue

        r.lrem(QUEUE_PROCESSING, 1, job_id)
        attempts = int(fields.get("attempts") or "0") + 1
        ts = _now_iso()

        if attempts >= max_attempts:
            r.hset(
                job_key(job_id),
                mapping={
                    "status": "failed",
                    "attempts": str(attempts),
                    "error": "visibility timeout exceeded",
                    "updated_at": ts,
                },
            )
            r.set(
                dead_key(job_id),
                json.dumps(
                    {
                        "job_id": job_id,
                        "error": "visibility timeout exceeded",
                        "attempts": attempts,
                    }
                ),
            )
        else:
            r.hset(
                job_key(job_id),
                mapping={
                    "status": "queued",
                    "attempts": str(attempts),
                    "updated_at": ts,
                },
            )
            r.lpush(QUEUE_READY, job_id)
        reclaimed += 1
    return reclaimed
