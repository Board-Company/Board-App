"""Worker completes a queued job (mocked engine for CI; optional real Stockfish)."""
from __future__ import annotations

import os
import shutil
from unittest.mock import MagicMock

import pytest

from engine.jobs import create_and_enqueue, get_job
from engine.queue import claim_job
from engine.schemas import AnalysisLine, JobResult
from engine_worker.__main__ import _process_job

START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@pytest.fixture
def redis_client():
    import fakeredis

    return fakeredis.FakeRedis(decode_responses=True)


def test_worker_process_job_writes_done(redis_client, monkeypatch):
    job_id, _ = create_and_enqueue(redis_client, fen=START_FEN, depth=5, profile="play")
    claimed = claim_job(redis_client, block_timeout_sec=1)
    assert claimed == job_id

    fake = JobResult(
        job_id=job_id,
        fen=START_FEN,
        status="done",
        depth=5,
        lines=[AnalysisLine(uci_pv=["e2e4"], score_cp=20)],
        bestmove_uci="e2e4",
        engine_time_ms=50,
    )
    monkeypatch.setattr(
        "engine_worker.__main__.analyse_payload",
        lambda _e, _p, on_progress=None: fake,
    )

    mock_engine = MagicMock()
    _process_job(redis_client, mock_engine, job_id)

    record = get_job(redis_client, job_id)
    assert record is not None
    assert record.status == "done"
    assert record.result is not None
    assert record.result.bestmove_uci == "e2e4"


@pytest.mark.skipif(
    shutil.which("stockfish") is None
    and not os.path.isfile(os.getenv("STOCKFISH_PATH", "/usr/games/stockfish")),
    reason="Stockfish binary not installed",
)
def test_analyse_payload_real_stockfish(redis_client):
    import chess.engine

    from engine.schemas import JobPayload
    from engine_worker.analyse import analyse_payload

    path = shutil.which("stockfish") or os.getenv("STOCKFISH_PATH", "/usr/games/stockfish")
    payload = JobPayload(
        job_id="test",
        fen=START_FEN,
        depth=8,
        multipv=1,
        profile="play",
        dedupe_key="sha256:test",
        enqueued_at="2026-01-01T00:00:00+00:00",
    )
    with chess.engine.SimpleEngine.popen_uci(path) as engine:
        result = analyse_payload(engine, payload)
    assert result.status == "done"
    assert result.bestmove_uci
    assert result.lines
