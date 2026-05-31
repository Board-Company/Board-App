"""Engine queue defaults (override via env where noted)."""
from __future__ import annotations

import os

VISIBILITY_TIMEOUT_SEC = int(os.getenv("ENGINE_VISIBILITY_TIMEOUT_SEC", "120"))
MAX_ATTEMPTS = int(os.getenv("ENGINE_MAX_ATTEMPTS", "3"))
DEDUPE_TTL_SEC = int(os.getenv("ENGINE_DEDUPE_TTL_SEC", str(24 * 3600)))
JOB_TERMINAL_TTL_SEC = int(os.getenv("ENGINE_JOB_TERMINAL_TTL_SEC", str(24 * 3600)))
MAX_DEPTH = int(os.getenv("ENGINE_MAX_DEPTH", "30"))
CLAIM_BLOCK_TIMEOUT_SEC = int(os.getenv("ENGINE_CLAIM_BLOCK_TIMEOUT_SEC", "5"))
PUBSUB_THROTTLE_PER_SEC = int(os.getenv("ENGINE_PUBSUB_THROTTLE_PER_SEC", "10"))


def default_redis_engine_url(redis_url: str | None = None) -> str:
    """Default engine Redis to db 1 on same host as REDIS_URL."""
    explicit = os.getenv("REDIS_ENGINE_URL")
    if explicit:
        return explicit
    base = redis_url or os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    if base.rstrip("/").endswith("/0"):
        return base.rsplit("/", 1)[0] + "/1"
    return base
