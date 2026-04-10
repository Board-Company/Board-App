"""Blocking Stockfish UCI via python-chess — call only from asyncio via ``asyncio.to_thread``."""
from __future__ import annotations

import os
import shutil
import threading
from typing import Literal

import chess
import chess.engine
from loguru import logger

from engine.models import AnalyseResponse, EngineLine, EngineScore

_engine: chess.engine.SimpleEngine | None = None
_engine_path: str | None = None
_lock = threading.Lock()


def resolve_stockfish_path() -> str | None:
    """Return executable path from ``STOCKFISH_PATH`` or ``PATH`` (``which stockfish``)."""
    env = os.getenv("STOCKFISH_PATH", "").strip()
    if env and os.path.isfile(env) and os.access(env, os.X_OK):
        return env
    found = shutil.which("stockfish")
    return found


def configure(path: str | None) -> None:
    """Set the binary used by the singleton engine (lazy-started on first analyse)."""
    global _engine_path
    _engine_path = path


def is_configured() -> bool:
    return bool(_engine_path)


def shutdown_engine() -> None:
    global _engine
    with _lock:
        if _engine is not None:
            try:
                _engine.quit()
            except Exception as e:  # noqa: BLE001
                logger.debug("engine quit: {}", e)
            _engine = None


def _destroy_engine_unlocked() -> None:
    global _engine
    if _engine is not None:
        try:
            _engine.quit()
        except Exception:  # noqa: BLE001
            pass
        _engine = None


def _ensure_engine_unlocked() -> chess.engine.SimpleEngine:
    global _engine
    if _engine_path is None:
        raise RuntimeError("Stockfish path not configured")
    if _engine is None:
        _engine = chess.engine.SimpleEngine.popen_uci(_engine_path)
    return _engine


def effective_search_params(
    profile: Literal["play", "analysis"] | None,
    depth: int | None,
    movetime_ms: int | None,
    multipv: int | None,
) -> tuple[int | None, int | None, int]:
    """Resolve depth, movetime_ms, multipv from profile and explicit fields."""
    if profile == "play":
        d = depth
        mt = movetime_ms
        mp = multipv if multipv is not None else 1
        if d is None and mt is None:
            mt = 200
    elif profile == "analysis":
        d = depth
        mt = movetime_ms
        mp = multipv if multipv is not None else 3
        if d is None and mt is None:
            d = 18
    else:
        d = depth
        mt = movetime_ms
        mp = multipv if multipv is not None else 1
        if d is None and mt is None:
            d = 12
    return d, mt, mp


def _build_limit(depth: int | None, movetime_ms: int | None) -> chess.engine.Limit:
    if depth is not None and movetime_ms is not None:
        return chess.engine.Limit(depth=depth, time=movetime_ms / 1000.0)
    if depth is not None:
        return chess.engine.Limit(depth=depth)
    if movetime_ms is not None:
        return chess.engine.Limit(time=movetime_ms / 1000.0)
    return chess.engine.Limit(depth=12)


def _score_white(info: dict) -> EngineScore:
    pov: chess.engine.PovScore = info["score"]
    w = pov.white()
    if w.is_mate():
        m = w.mate()
        assert m is not None
        return EngineScore(kind="mate", value=m)
    cp = w.score()
    assert cp is not None
    return EngineScore(kind="cp", value=cp)


def _infos_to_lines(infos: list[dict] | dict) -> list[EngineLine]:
    if isinstance(infos, dict):
        infos_list = [infos]
    else:
        infos_list = infos
    lines: list[EngineLine] = []
    for i, info in enumerate(infos_list, start=1):
        pv = info.get("pv") or []
        pv_uci = [m.uci() for m in pv]
        lines.append(
            EngineLine(
                multipv=i,
                score=_score_white(info),
                pv_uci=pv_uci,
            )
        )
    return lines


def analyse_position_sync(
    fen: str,
    profile: Literal["play", "analysis"] | None,
    depth: int | None,
    movetime_ms: int | None,
    multipv: int | None,
) -> AnalyseResponse:
    try:
        board = chess.Board(fen)
    except ValueError as e:
        raise ValueError("Invalid FEN") from e

    d, mt, mp = effective_search_params(profile, depth, movetime_ms, multipv)
    limit = _build_limit(d, mt)

    with _lock:
        try:
            eng = _ensure_engine_unlocked()
            raw = eng.analyse(board, limit, multipv=mp)
        except chess.engine.EngineTerminatedError:
            _destroy_engine_unlocked()
            raise

    lines = _infos_to_lines(raw)
    bestmove_uci = lines[0].pv_uci[0] if lines and lines[0].pv_uci else None

    return AnalyseResponse(
        fen=board.fen(),
        profile=profile,
        depth=d,
        movetime_ms=mt,
        multipv=mp,
        bestmove_uci=bestmove_uci,
        lines=lines,
    )
