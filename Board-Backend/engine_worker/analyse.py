"""Run Stockfish UCI analysis for a queued job payload."""
from __future__ import annotations

import time
from collections.abc import Callable

import chess
import chess.engine

from engine.schemas import AnalysisLine, JobPayload, JobResult


def _score_from_white(info: chess.engine.InfoDict) -> tuple[int | None, int | None]:
    score = info.get("score")
    if score is None:
        return None, None
    white_score = score.white()
    if white_score.is_mate():
        mate = white_score.mate()
        return None, mate
    cp = white_score.score()
    return cp, None


def _info_to_line(info: chess.engine.InfoDict) -> AnalysisLine:
    pv = info.get("pv") or []
    cp, mate = _score_from_white(info)
    return AnalysisLine(
        uci_pv=[m.uci() for m in pv],
        score_cp=cp,
        score_mate=mate,
    )


def _infos_to_result(
    payload: JobPayload,
    infos: list[chess.engine.InfoDict],
    *,
    status: str = "running",
    started: float,
) -> JobResult:
    lines = [_info_to_line(info) for info in infos if info.get("pv") or info.get("score")]
    if not lines and infos:
        lines = [_info_to_line(infos[-1])]
    bestmove_uci = None
    if lines and lines[0].uci_pv:
        bestmove_uci = lines[0].uci_pv[0]
    depth_reached = max((info.get("depth") or 0 for info in infos), default=0) or payload.depth
    return JobResult(
        job_id=payload.job_id,
        fen=payload.fen,
        status=status,  # type: ignore[arg-type]
        depth=depth_reached,
        multipv=max(1, payload.multipv),
        lines=lines,
        bestmove_uci=bestmove_uci,
        engine_time_ms=int((time.monotonic() - started) * 1000),
    )


def analyse_payload(
    engine: chess.engine.SimpleEngine,
    payload: JobPayload,
    on_progress: Callable[[JobResult], None] | None = None,
) -> JobResult:
    board = chess.Board(payload.fen)
    started = time.monotonic()

    if payload.movetime_ms:
        limit = chess.engine.Limit(time=payload.movetime_ms / 1000.0)
    else:
        limit = chess.engine.Limit(depth=payload.depth)

    multipv = max(1, payload.multipv)
    collected: list[chess.engine.InfoDict] = []

    with engine.analysis(board, limit, multipv=multipv) as analysis:
        for info in analysis:
            if info.get("depth") is None and info.get("score") is None and not info.get("pv"):
                continue
            collected.append(info)
            if on_progress and (info.get("depth") or info.get("pv")):
                partial = _infos_to_result(
                    payload, collected, status="running", started=started
                )
                on_progress(partial)

    if not collected:
        raw = engine.analyse(board, limit, multipv=multipv)
        infos = raw if isinstance(raw, list) else [raw]
        return _infos_to_result(payload, infos, status="done", started=started)

    final = _infos_to_result(payload, collected, status="done", started=started)
    return final
