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


async def _no_message(*_args, **_kwargs):
    # Yield to the loop like a real socket wait would, so a stream that never ends
    # fails the test's wait_for instead of spinning forever.
    await asyncio.sleep(0.01)
    return None


def _mock_pubsub(async_redis, *, on_subscribe=None, get_message=None):
    pubsub_instance = MagicMock()
    pubsub_instance.subscribe = AsyncMock(side_effect=on_subscribe)
    pubsub_instance.unsubscribe = AsyncMock()
    pubsub_instance.aclose = AsyncMock()
    pubsub_instance.get_message = AsyncMock(side_effect=get_message or _no_message)
    async_redis.pubsub = MagicMock(return_value=pubsub_instance)
    return pubsub_instance


def _done_result(job_id: str) -> JobResult:
    return JobResult(
        job_id=job_id,
        fen=START_FEN,
        status="done",
        depth=8,
        lines=[AnalysisLine(uci_pv=["e2e4"], score_cp=30)],
        bestmove_uci="e2e4",
    )


@pytest.mark.asyncio
async def test_stream_sees_job_that_finished_before_subscribe(async_redis):
    """Job finishes (and publishes to nobody) between the first read and SUBSCRIBE."""
    job_id, _ = await create_and_enqueue_async(async_redis, fen=START_FEN, depth=8)

    async def finish_during_subscribe(*_args, **_kwargs):
        await set_job_result_async(async_redis, job_id, _done_result(job_id))

    _mock_pubsub(async_redis, on_subscribe=finish_during_subscribe)

    async def collect():
        return [chunk async for chunk in stream_job_events(async_redis, job_id)]

    chunks = await asyncio.wait_for(collect(), timeout=2)
    data = [json.loads(c.removeprefix("data: ").strip()) for c in chunks if c.startswith("data: ")]
    assert data[-1]["status"] == "done"


@pytest.mark.asyncio
async def test_stream_rereads_hash_when_notify_is_missed(async_redis, monkeypatch):
    """No publish ever arrives; the keepalive timeout re-read still delivers the result."""
    job_id, _ = await create_and_enqueue_async(async_redis, fen=START_FEN, depth=8)
    calls = 0

    async def silent_get_message(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            await set_job_result_async(async_redis, job_id, _done_result(job_id))
        return await _no_message()

    _mock_pubsub(async_redis, get_message=silent_get_message)

    async def collect():
        return [chunk async for chunk in stream_job_events(async_redis, job_id)]

    chunks = await asyncio.wait_for(collect(), timeout=2)
    data = [json.loads(c.removeprefix("data: ").strip()) for c in chunks if c.startswith("data: ")]
    assert [d["status"] for d in data] == ["queued", "done"]
