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
    assert len(result.lines) == 1
    assert result.depth == 8


class _FakeAnalysis:
    """Stands in for python-chess `engine.analysis(...)`: yields info dicts in order."""

    def __init__(self, infos):
        self._infos = infos

    def __enter__(self):
        return iter(self._infos)

    def __exit__(self, *exc):
        return False


def _info(depth: int, cp: int, move: str, multipv: int = 1):
    import chess
    import chess.engine

    return {
        "depth": depth,
        "multipv": multipv,
        "score": chess.engine.PovScore(chess.engine.Cp(cp), chess.WHITE),
        "pv": [chess.Move.from_uci(move)],
    }


def _payload(multipv: int = 1):
    from engine.schemas import JobPayload

    return JobPayload(
        job_id="test",
        fen=START_FEN,
        depth=3,
        multipv=multipv,
        profile="analysis",
        dedupe_key="sha256:test",
        enqueued_at="2026-01-01T00:00:00+00:00",
    )


def test_analyse_payload_reports_deepest_line_not_first():
    from engine_worker.analyse import analyse_payload

    engine = MagicMock()
    engine.analysis.return_value = _FakeAnalysis(
        [_info(1, 10, "a2a3"), _info(2, 25, "d2d4"), _info(3, 40, "e2e4")]
    )
    progress = []
    result = analyse_payload(engine, _payload(), on_progress=progress.append)

    assert len(result.lines) == 1
    assert result.lines[0].score_cp == 40
    assert result.bestmove_uci == "e2e4"
    assert result.depth == 3
    assert [p.lines[0].score_cp for p in progress] == [10, 25, 40]


def test_analyse_payload_keeps_one_line_per_multipv_slot():
    from engine_worker.analyse import analyse_payload

    engine = MagicMock()
    engine.analysis.return_value = _FakeAnalysis(
        [
            _info(1, 10, "a2a3", 1), _info(1, 5, "h2h3", 2),
            _info(2, 30, "e2e4", 1), _info(2, 20, "d2d4", 2),
        ]
    )
    result = analyse_payload(engine, _payload(multipv=2))

    assert [line.score_cp for line in result.lines] == [30, 20]
    assert result.bestmove_uci == "e2e4"
