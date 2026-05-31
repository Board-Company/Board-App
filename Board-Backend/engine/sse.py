"""SSE stream for engine job progress (subscribe-then-snapshot)."""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
import contextlib

from redis.asyncio import Redis

from engine.jobs import get_job_async, is_terminal_status
from engine.keys import events_channel
from engine.schemas import JobRecord

KEEPALIVE_SEC = 25


def job_record_to_sse_data(record: JobRecord) -> dict:
    return {
        "job_id": record.job_id,
        "fen": record.fen,
        "status": record.status,
        "result": record.result.model_dump() if record.result else None,
        "error": record.error,
        "updated_at": record.updated_at,
    }


def format_sse_event(data: dict) -> str:
    return f"data: {json.dumps(data, separators=(',', ':'))}\n\n"


async def stream_job_events(redis: Redis, job_id: str) -> AsyncIterator[str]:
    """
    Yield SSE events: first snapshot from hash, then updates after pub/sub notify.
    Re-reads hash on each notify (pub/sub is notification only).
    """
    record = await get_job_async(redis, job_id)
    if record is None:
        return

    last_updated = record.updated_at
    yield format_sse_event(job_record_to_sse_data(record))

    if is_terminal_status(record.status):
        return

    pubsub = redis.pubsub()
    await pubsub.subscribe(events_channel(job_id))

    try:
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=KEEPALIVE_SEC,
            )
            if message is None:
                yield ": keepalive\n\n"
                continue

            record = await get_job_async(redis, job_id)
            if record is None:
                break

            if record.updated_at != last_updated:
                last_updated = record.updated_at
                yield format_sse_event(job_record_to_sse_data(record))
                if is_terminal_status(record.status):
                    break
    finally:
        with contextlib.suppress(Exception):
            await pubsub.unsubscribe(events_channel(job_id))
            await pubsub.aclose()
