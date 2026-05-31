"""Unit tests for engine SSE stream (pub/sub mocked — fakeredis lacks async pubsub)."""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from engine.jobs import create_and_enqueue_async, get_job, set_job_result_async
from engine.schemas import AnalysisLine, JobResult
from engine.sse import format_sse_event, job_record_to_sse_data, stream_job_events

START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@pytest.fixture
async def async_redis():
    import fakeredis.aioredis

    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.mark.asyncio
async def test_stream_snapshot_when_already_done(async_redis):
    job_id, _ = await create_and_enqueue_async(async_redis, fen=START_FEN, depth=6)
    await set_job_result_async(
        async_redis,
        job_id,
        JobResult(
            job_id=job_id,
            fen=START_FEN,
            status="done",
            depth=6,
            lines=[AnalysisLine(uci_pv=["e2e4"], score_cp=20)],
            bestmove_uci="e2e4",
        ),
    )

    chunks = []
    async for chunk in stream_job_events(async_redis, job_id):
        chunks.append(chunk)

    assert len(chunks) == 1
    data = json.loads(chunks[0].removeprefix("data: ").strip())
    assert data["status"] == "done"
    assert data["result"]["bestmove_uci"] == "e2e4"


@pytest.mark.asyncio
async def test_stream_update_after_pubsub_notify(async_redis, monkeypatch):
    job_id, _ = await create_and_enqueue_async(async_redis, fen=START_FEN, depth=8)

    call_count = 0

    async def fake_get_message(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            await set_job_result_async(
                async_redis,
                job_id,
                JobResult(
                    job_id=job_id,
                    fen=START_FEN,
                    status="done",
                    depth=8,
                    lines=[AnalysisLine(uci_pv=["e2e4"], score_cp=30)],
                    bestmove_uci="e2e4",
                ),
            )
            return {"type": "message", "data": json.dumps({"job_id": job_id})}
        return None

    pubsub_instance = MagicMock()
    pubsub_instance.subscribe = AsyncMock()
    pubsub_instance.unsubscribe = AsyncMock()
    pubsub_instance.aclose = AsyncMock()
    pubsub_instance.get_message = AsyncMock(side_effect=fake_get_message)
    async_redis.pubsub = MagicMock(return_value=pubsub_instance)

    ag = stream_job_events(async_redis, job_id)
    chunks = []
    try:
        chunks.append(await anext(ag))
        chunks.append(await anext(ag))
    finally:
        await ag.aclose()

    assert len(chunks) >= 2
    first = json.loads(chunks[0].removeprefix("data: ").strip())
    last = json.loads(chunks[-1].removeprefix("data: ").strip())
    assert first["status"] == "queued"
    assert last["status"] == "done"


def test_job_record_to_sse_data_includes_fen_and_job_id():
    import fakeredis

    from engine.jobs import create_and_enqueue

    r = fakeredis.FakeRedis(decode_responses=True)
    job_id, _ = create_and_enqueue(r, fen=START_FEN, depth=5)
    record = get_job(r, job_id)
    data = job_record_to_sse_data(record)
    assert data["job_id"] == job_id
    assert data["fen"] == START_FEN
    assert format_sse_event(data).startswith("data: ")
