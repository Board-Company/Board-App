from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


JobStatus = Literal["queued", "running", "done", "failed", "cancelled"]
JobProfile = Literal["play", "analysis"]


class JobPayload(BaseModel):
    job_id: str
    kind: Literal["position"] = "position"
    fen: str
    depth: int
    multipv: int = 1
    profile: JobProfile = "analysis"
    dedupe_key: str
    enqueued_at: str
    source_game_id: Optional[str] = None
    source_ply: Optional[int] = None
    movetime_ms: Optional[int] = None


class AnalysisLine(BaseModel):
    uci_pv: list[str] = Field(default_factory=list)
    score_cp: Optional[int] = None
    score_mate: Optional[int] = None


class JobResult(BaseModel):
    job_id: str
    fen: str
    status: JobStatus
    depth: Optional[int] = None
    multipv: Optional[int] = None
    lines: list[AnalysisLine] = Field(default_factory=list)
    bestmove_uci: Optional[str] = None
    engine_time_ms: Optional[int] = None
    error: Optional[str] = None


class JobRecord(BaseModel):
    job_id: str
    status: JobStatus
    fen: str
    payload: JobPayload
    result: Optional[JobResult] = None
    attempts: int = 0
    created_at: str
    updated_at: str
    claimed_at: Optional[str] = None
    error: Optional[str] = None
    cancel_requested: bool = False


class CreateJobRequest(BaseModel):
    fen: Optional[str] = None
    game_id: Optional[str] = None
    ply: Optional[int] = Field(default=None, ge=0)
    depth: int = Field(..., ge=1)
    multipv: int = Field(default=1, ge=1, le=5)
    profile: JobProfile = "analysis"
    movetime_ms: Optional[int] = Field(default=None, ge=1)


class CreateJobResponse(BaseModel):
    job_id: str
    dedupe_hit: bool = False


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    fen: str
    dedupe_hit: bool = False
    payload: JobPayload
    result: Optional[JobResult] = None
    attempts: int = 0
    created_at: str
    updated_at: str
    error: Optional[str] = None
    cancel_requested: bool = False
