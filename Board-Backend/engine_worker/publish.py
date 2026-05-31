"""Partial job updates + pub/sub notify (worker writes hash; SSE reads hash)."""
from __future__ import annotations

import json
import time

import redis

from engine.config import PUBSUB_THROTTLE_PER_SEC
from engine.jobs import set_job_result
from engine.keys import events_channel
from engine.schemas import JobResult, JobStatus


class ProgressPublisher:
    """Throttle Redis PUBLISH; always update job hash on progress."""

    def __init__(self, max_per_sec: int = PUBSUB_THROTTLE_PER_SEC) -> None:
        self._min_interval = 1.0 / max(1, max_per_sec)
        self._last_publish = 0.0

    def push(
        self,
        r: redis.Redis,
        job_id: str,
        result: JobResult,
        *,
        status_value: JobStatus = "running",
        force: bool = False,
    ) -> None:
        set_job_result(r, job_id, result, status_value=status_value)
        now = time.monotonic()
        if force or (now - self._last_publish) >= self._min_interval:
            r.publish(events_channel(job_id), json.dumps({"job_id": job_id}))
            self._last_publish = now
