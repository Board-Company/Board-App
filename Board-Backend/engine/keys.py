"""Redis key layout for engine jobs (see docs/plans/stockfish-queue-live-analysis.plan.md)."""

QUEUE_READY = "engine:queue:ready"
QUEUE_PROCESSING = "engine:queue:processing"

TERMINAL_STATUSES = frozenset({"done", "failed", "cancelled"})


def job_key(job_id: str) -> str:
    return f"engine:job:{job_id}"


def dedupe_key(dedupe_key_hash: str) -> str:
    return f"engine:dedupe:{dedupe_key_hash}"


def idempotency_key(key: str) -> str:
    return f"engine:idempo:{key}"


def events_channel(job_id: str) -> str:
    return f"engine:events:{job_id}"


def dead_key(job_id: str) -> str:
    return f"engine:dead:{job_id}"
