"""Engine analysis job HTTP routes (enqueue + read — no Stockfish in API process)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis

from auth import get_current_active_user
from engine.archive import load_completed_game_fen
from engine.jobs import create_and_enqueue_async, get_job_async, request_cancel_async
from engine.schemas import CreateJobRequest, CreateJobResponse, JobStatusResponse
from engine.sse import stream_job_events
from schemas import User
from supabase_client import supabase

router = APIRouter()


def _redis_engine(request: Request) -> Redis:
    r = getattr(request.app.state, "redis_engine", None)
    if r is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Engine Redis is not available",
        )
    return r


def _user_id(user: User) -> str:
    if not user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User id missing; ensure users row has id and re-login if needed",
        )
    return str(user.id)


def _record_to_response(record, *, dedupe_hit: bool = False) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=record.job_id,
        status=record.status,
        fen=record.fen,
        dedupe_hit=dedupe_hit,
        payload=record.payload,
        result=record.result,
        attempts=record.attempts,
        created_at=record.created_at,
        updated_at=record.updated_at,
        error=record.error,
        cancel_requested=record.cancel_requested,
    )


async def _resolve_enqueue_params(
    body: CreateJobRequest,
    user_id: str,
) -> tuple[str, Optional[str], Optional[int]]:
    if body.fen:
        if body.game_id or body.ply is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Provide fen or game_id+ply, not both",
            )
        return body.fen, None, None

    if body.game_id is None or body.ply is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="fen or (game_id and ply) required",
        )

    fen, gid, ply = load_completed_game_fen(
        supabase,
        game_id=body.game_id,
        ply=body.ply,
        user_id=user_id,
    )
    return fen, gid, ply


@router.post("/jobs", response_model=CreateJobResponse)
async def create_engine_job(
    request: Request,
    body: CreateJobRequest,
    current_user: User = Depends(get_current_active_user),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    redis = _redis_engine(request)
    user_id = _user_id(current_user)
    fen, source_game_id, source_ply = await _resolve_enqueue_params(body, user_id)

    job_id, dedupe_hit = await create_and_enqueue_async(
        redis,
        fen=fen,
        depth=body.depth,
        multipv=body.multipv,
        profile=body.profile,
        movetime_ms=body.movetime_ms,
        idempotency_key_header=idempotency_key,
        source_game_id=source_game_id,
        source_ply=source_ply,
    )
    return CreateJobResponse(job_id=job_id, dedupe_hit=dedupe_hit)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_engine_job(
    request: Request,
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    _ = _user_id(current_user)
    redis = _redis_engine(request)
    record = await get_job_async(redis, job_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return _record_to_response(record)


@router.get("/jobs/{job_id}/events")
async def stream_engine_job_events(
    request: Request,
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    _ = _user_id(current_user)
    redis = _redis_engine(request)
    record = await get_job_async(redis, job_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    async def _generate():
        async for chunk in stream_job_events(redis, job_id):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_engine_job(
    request: Request,
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    _ = _user_id(current_user)
    redis = _redis_engine(request)
    ok = await request_cancel_async(redis, job_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"job_id": job_id, "cancel_requested": True}
