import asyncio

import chess.engine
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_active_user
from engine import service as engine_service
from engine.models import AnalyseRequest, AnalyseResponse
from schemas import User

router = APIRouter()


@router.post("/analyse", response_model=AnalyseResponse)
async def analyse(
    body: AnalyseRequest,
    _user: User = Depends(get_current_active_user),
) -> AnalyseResponse:
    if not engine_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stockfish is not configured (set STOCKFISH_PATH or install stockfish on PATH)",
        )
    try:
        return await asyncio.to_thread(
            engine_service.analyse_position_sync,
            body.fen,
            body.profile,
            body.depth,
            body.movetime_ms,
            body.multipv,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except (chess.engine.EngineError, chess.engine.EngineTerminatedError) as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Engine error: {e}",
        ) from e
