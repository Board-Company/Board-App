from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class EngineScore(BaseModel):
    """Score from White's perspective (python-chess `PovScore.white()`)."""

    kind: Literal["cp", "mate"]
    value: int


class EngineLine(BaseModel):
    multipv: int
    score: EngineScore
    pv_uci: list[str]


class AnalyseRequest(BaseModel):
    fen: str = Field(..., description="Position FEN; validated with python-chess")
    profile: Literal["play", "analysis"] | None = Field(
        None,
        description="play: short movetime, multipv=1; analysis: deeper, multipv=3 unless overridden",
    )
    depth: int | None = Field(None, ge=1, le=64)
    movetime_ms: int | None = Field(None, ge=50, le=600_000)
    multipv: int | None = Field(None, ge=1, le=5)


class AnalyseResponse(BaseModel):
    fen: str
    profile: Literal["play", "analysis"] | None
    depth: int | None
    movetime_ms: int | None
    multipv: int
    bestmove_uci: str | None
    lines: list[EngineLine]
