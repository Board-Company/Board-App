"""Phase 0: engine Redis queue + job hash (no Stockfish, no HTTP yet)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import fakeredis
import pytest

from engine.config import VISIBILITY_TIMEOUT_SEC
from engine.jobs import create_and_enqueue, get_job, set_job_result
from engine.keys import QUEUE_PROCESSING, QUEUE_READY, job_key
from engine.queue import ack_job, claim_job, enqueue_ready, reclaim_stale_jobs, release_job_to_ready
from engine.schemas import AnalysisLine, JobResult


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@pytest.fixture
def redis_client():
    return fakeredis.FakeRedis(decode_responses=True)


def test_enqueue_claim_ack_hash_read(redis_client):
    job_id, dedupe_hit = create_and_enqueue(
        redis_client, fen=START_FEN, depth=12, profile="play"
    )
    assert dedupe_hit is False
    assert redis_client.llen(QUEUE_READY) == 1

    claimed = claim_job(redis_client, block_timeout_sec=1)
    assert claimed == job_id
    assert redis_client.llen(QUEUE_PROCESSING) == 1
    assert redis_client.llen(QUEUE_READY) == 0

    record = get_job(redis_client, job_id)
    assert record is not None
    assert record.status == "running"
    assert record.claimed_at
    assert record.payload.depth == 12

    set_job_result(
        redis_client,
        job_id,
        JobResult(
            job_id=job_id,
            fen=START_FEN,
            status="done",
            depth=12,
            lines=[AnalysisLine(uci_pv=["e2e4"], score_cp=20)],
            bestmove_uci="e2e4",
            engine_time_ms=100,
        ),
    )
    removed = ack_job(redis_client, job_id)
    assert removed == 1
    assert redis_client.llen(QUEUE_PROCESSING) == 0

    final = get_job(redis_client, job_id)
    assert final is not None
    assert final.status == "done"
    assert final.result is not None
    assert final.result.bestmove_uci == "e2e4"


def test_dedupe_returns_same_open_job(redis_client):
    j1, hit1 = create_and_enqueue(redis_client, fen=START_FEN, depth=10)
    j2, hit2 = create_and_enqueue(redis_client, fen=START_FEN, depth=10)
    assert hit1 is False
    assert hit2 is True
    assert j1 == j2
    assert redis_client.llen(QUEUE_READY) == 1


def test_idempotency_key(redis_client):
    j1, _ = create_and_enqueue(
        redis_client,
        fen=START_FEN,
        depth=8,
        idempotency_key_header="idem-abc",
    )
    j2, hit = create_and_enqueue(
        redis_client,
        fen=START_FEN,
        depth=8,
        idempotency_key_header="idem-abc",
    )
    assert hit is True
    assert j1 == j2


def test_reclaimer_moves_stale_running_back_to_ready(redis_client):
    job_id, _ = create_and_enqueue(redis_client, fen=START_FEN, depth=5)
    claim_job(redis_client, block_timeout_sec=1)

    stale = (datetime.now(timezone.utc) - timedelta(seconds=VISIBILITY_TIMEOUT_SEC + 10)).isoformat()
    redis_client.hset(job_key(job_id), "claimed_at", stale)

    n = reclaim_stale_jobs(redis_client, visibility_timeout_sec=VISIBILITY_TIMEOUT_SEC)
    assert n == 1
    assert redis_client.llen(QUEUE_PROCESSING) == 0
    assert redis_client.llen(QUEUE_READY) == 1

    record = get_job(redis_client, job_id)
    assert record is not None
    assert record.status == "queued"
    assert record.attempts == 1


def test_release_job_to_ready_on_shutdown(redis_client):
    job_id, _ = create_and_enqueue(redis_client, fen=START_FEN, depth=5)
    claim_job(redis_client, block_timeout_sec=1)
    assert redis_client.llen(QUEUE_PROCESSING) == 1

    release_job_to_ready(redis_client, job_id)
    assert redis_client.llen(QUEUE_PROCESSING) == 0
    assert redis_client.llen(QUEUE_READY) == 1
    record = get_job(redis_client, job_id)
    assert record is not None
    assert record.status == "queued"


def test_manual_enqueue_ready_only_job_id(redis_client):
    """Worker test path: LPUSH job_id after hash exists."""
    job_id = "test-manual-id"
    redis_client.hset(
        job_key(job_id),
        mapping={
            "status": "queued",
            "fen": START_FEN,
            "payload_json": "{}",
            "attempts": "0",
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:00+00:00",
        },
    )
    enqueue_ready(redis_client, job_id)
    claimed = claim_job(redis_client, block_timeout_sec=1)
    assert claimed == job_id
