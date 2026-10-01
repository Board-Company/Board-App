"""Job hash CRUD, dedupe, enqueue (sync for worker tests; async for API)."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

import chess
import redis
import redis.asyncio as redis_async
from fastapi import HTTPException, status

from engine.config import DEDUPE_TTL_SEC, JOB_TERMINAL_TTL_SEC, MAX_DEPTH
from engine.keys import TERMINAL_STATUSES, dedupe_key, idempotency_key, job_key
from engine.schemas import JobPayload, JobRecord, JobResult, JobStatus


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_fen(fen: str) -> str:
    try:
        board = chess.Board(fen)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Illegal FEN: {e}",
        ) from e
    return board.fen()


def compute_dedupe_key(
    *,
    fen: str | None = None,
    game_id: str | None = None,
    ply: int | None = None,
    depth: int,
    multipv: int = 1,
    profile: str = "analysis",
) -> str:
    if game_id is not None and ply is not None:
        canonical = f"game:{game_id}:ply:{ply}:d:{depth}:m:{multipv}:p:{profile}"
    elif fen is not None:
        canonical = f"fen:{fen}:d:{depth}:m:{multipv}:p:{profile}"
    else:
        raise ValueError("fen or (game_id and ply) required for dedupe_key")
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    return f"sha256:{digest}"


def _parse_job_record(job_id: str, fields: dict[str, str]) -> JobRecord:
    payload_raw = fields.get("payload_json") or "{}"
    payload = JobPayload.model_validate(json.loads(payload_raw))
    result: JobResult | None = None
    result_raw = fields.get("result_json") or ""
    if result_raw:
        result = JobResult.model_validate(json.loads(result_raw))
    cancel = fields.get("cancel_requested", "0")
    return JobRecord(
        job_id=job_id,
        status=fields.get("status", "queued"),  # type: ignore[arg-type]
        fen=fields.get("fen") or payload.fen,
        payload=payload,
        result=result,
        attempts=int(fields.get("attempts") or "0"),
        created_at=fields.get("created_at") or "",
        updated_at=fields.get("updated_at") or "",
        claimed_at=fields.get("claimed_at") or None,
        error=fields.get("error") or None,
        cancel_requested=cancel in ("1", "true", "True"),
    )


def is_terminal_status(status_value: str) -> bool:
    return status_value in TERMINAL_STATUSES


def _as_text(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode()
    return str(value)


def _reusable_job_id(r: redis.Redis, mapped_job_id: str | None) -> str | None:
    """Reuse in-flight jobs and completed analyses; never reuse cancelled/failed."""
    if not mapped_job_id:
        return None
    fields = r.hmget(job_key(mapped_job_id), "status", "cancel_requested")
    st = _as_text(fields[0] if fields else None)
    cancel = _as_text(fields[1] if fields and len(fields) > 1 else None)
    if not st:
        return None
    if (cancel or "") in ("1", "true", "True"):
        return None
    if st == "done":
        return mapped_job_id
    if not is_terminal_status(st):
        return mapped_job_id
    return None


async def _reusable_job_id_async(
    r: redis_async.Redis, mapped_job_id: str | None
) -> str | None:
    if not mapped_job_id:
        return None
    fields = await r.hmget(job_key(mapped_job_id), "status", "cancel_requested")
    st = _as_text(fields[0] if fields else None)
    cancel = _as_text(fields[1] if fields and len(fields) > 1 else None)
    if not st:
        return None
    if (cancel or "") in ("1", "true", "True"):
        return None
    if st == "done":
        return mapped_job_id
    if not is_terminal_status(st):
        return mapped_job_id
    return None


def _hash_mapping(
    *,
    fen: str,
    payload: JobPayload,
    status_value: JobStatus = "queued",
    attempts: int = 0,
    now: str | None = None,
) -> dict[str, str]:
    ts = now or _now_iso()
    return {
        "status": status_value,
        "fen": fen,
        "payload_json": payload.model_dump_json(),
        "result_json": "",
        "attempts": str(attempts),
        "created_at": ts,
        "updated_at": ts,
        "claimed_at": "",
        "error": "",
        "cancel_requested": "0",
    }


def create_and_enqueue(
    r: redis.Redis,
    *,
    fen: str,
    depth: int,
    multipv: int = 1,
    profile: str = "analysis",
    movetime_ms: int | None = None,
    idempotency_key_header: str | None = None,
    source_game_id: str | None = None,
    source_ply: int | None = None,
) -> tuple[str, bool]:
    """Create job hash + LPUSH ready. Returns (job_id, dedupe_hit)."""
    if depth < 1 or depth > MAX_DEPTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"depth must be between 1 and {MAX_DEPTH}",
        )
    fen = validate_fen(fen)
    dk = compute_dedupe_key(
        fen=fen,
        game_id=source_game_id,
        ply=source_ply,
        depth=depth,
        multipv=multipv,
        profile=profile,
    )

    hit = _reusable_job_id(r, r.get(dedupe_key(dk)))
    if hit:
        return hit, True

    if idempotency_key_header:
        hit = _reusable_job_id(r, r.get(idempotency_key(idempotency_key_header)))
        if hit:
            return hit, True

    job_id = str(uuid.uuid4())
    now = _now_iso()
    payload = JobPayload(
        job_id=job_id,
        fen=fen,
        depth=depth,
        multipv=multipv,
        profile=profile,  # type: ignore[arg-type]
        dedupe_key=dk,
        enqueued_at=now,
        source_game_id=source_game_id,
        source_ply=source_ply,
        movetime_ms=movetime_ms,
    )
    r.hset(job_key(job_id), mapping=_hash_mapping(fen=fen, payload=payload, now=now))
    # Claim the dedupe key atomically (see create_and_enqueue_async).
    if not r.set(dedupe_key(dk), job_id, nx=True, ex=DEDUPE_TTL_SEC):
        hit = _reusable_job_id(r, r.get(dedupe_key(dk)))
        if hit:
            r.delete(job_key(job_id))
            return hit, True
        r.set(dedupe_key(dk), job_id, ex=DEDUPE_TTL_SEC)
    if idempotency_key_header:
        r.setex(idempotency_key(idempotency_key_header), DEDUPE_TTL_SEC, job_id)
    from engine.queue import enqueue_ready

    enqueue_ready(r, job_id)
    return job_id, False


async def create_and_enqueue_async(
    r: redis_async.Redis,
    *,
    fen: str,
    depth: int,
    multipv: int = 1,
    profile: str = "analysis",
    movetime_ms: int | None = None,
    idempotency_key_header: str | None = None,
    source_game_id: str | None = None,
    source_ply: int | None = None,
) -> tuple[str, bool]:
    if depth < 1 or depth > MAX_DEPTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"depth must be between 1 and {MAX_DEPTH}",
        )
    fen = validate_fen(fen)
    dk = compute_dedupe_key(
        fen=fen,
        game_id=source_game_id,
        ply=source_ply,
        depth=depth,
        multipv=multipv,
        profile=profile,
    )

    hit = await _reusable_job_id_async(r, await r.get(dedupe_key(dk)))
    if hit:
        return hit, True

    if idempotency_key_header:
        hit = await _reusable_job_id_async(
            r, await r.get(idempotency_key(idempotency_key_header))
        )
        if hit:
            return hit, True

    job_id = str(uuid.uuid4())
    now = _now_iso()
    payload = JobPayload(
        job_id=job_id,
        fen=fen,
        depth=depth,
        multipv=multipv,
        profile=profile,  # type: ignore[arg-type]
        dedupe_key=dk,
        enqueued_at=now,
        source_game_id=source_game_id,
        source_ply=source_ply,
        movetime_ms=movetime_ms,
    )
    await r.hset(job_key(job_id), mapping=_hash_mapping(fen=fen, payload=payload, now=now))
    # Claim the dedupe key atomically. Both players request the same position within
    # milliseconds of each other; a GET above plus a plain SETEX here let both requests
    # miss and both enqueue. The hash is written first, so whoever owns the key always
    # has a readable job. The loser drops its unqueued hash and shares the winner's job.
    if not await r.set(dedupe_key(dk), job_id, nx=True, ex=DEDUPE_TTL_SEC):
        hit = await _reusable_job_id_async(r, await r.get(dedupe_key(dk)))
        if hit:
            await r.delete(job_key(job_id))
            return hit, True
        # Mapped job was cancelled, failed or expired: take the key over.
        await r.set(dedupe_key(dk), job_id, ex=DEDUPE_TTL_SEC)
    if idempotency_key_header:
        await r.setex(idempotency_key(idempotency_key_header), DEDUPE_TTL_SEC, job_id)
    await r.lpush("engine:queue:ready", job_id)
    return job_id, False


def get_job(r: redis.Redis, job_id: str) -> JobRecord | None:
    fields = r.hgetall(job_key(job_id))
    if not fields:
        return None
    return _parse_job_record(job_id, fields)


async def get_job_async(r: redis_async.Redis, job_id: str) -> JobRecord | None:
    fields = await r.hgetall(job_key(job_id))
    if not fields:
        return None
    return _parse_job_record(job_id, fields)


def set_job_result(
    r: redis.Redis,
    job_id: str,
    result: JobResult,
    *,
    status_value: JobStatus = "done",
) -> None:
    now = _now_iso()
    mapping: dict[str, str] = {
        "status": status_value,
        "result_json": result.model_dump_json(),
        "updated_at": now,
    }
    if result.error:
        mapping["error"] = result.error
    r.hset(job_key(job_id), mapping=mapping)
    if is_terminal_status(status_value):
        r.expire(job_key(job_id), JOB_TERMINAL_TTL_SEC)


async def set_job_result_async(
    r: redis_async.Redis,
    job_id: str,
    result: JobResult,
    *,
    status_value: JobStatus = "done",
) -> None:
    now = _now_iso()
    mapping: dict[str, str] = {
        "status": status_value,
        "result_json": result.model_dump_json(),
        "updated_at": now,
    }
    if result.error:
        mapping["error"] = result.error
    await r.hset(job_key(job_id), mapping=mapping)
    if is_terminal_status(status_value):
        await r.expire(job_key(job_id), JOB_TERMINAL_TTL_SEC)


def request_cancel(r: redis.Redis, job_id: str) -> bool:
    if not r.exists(job_key(job_id)):
        return False
    r.hset(job_key(job_id), mapping={"cancel_requested": "1", "updated_at": _now_iso()})
    return True


async def request_cancel_async(r: redis_async.Redis, job_id: str) -> bool:
    if not await r.exists(job_key(job_id)):
        return False
    await r.hset(
        job_key(job_id), mapping={"cancel_requested": "1", "updated_at": _now_iso()}
    )
    return True
