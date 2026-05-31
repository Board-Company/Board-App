"""Resolve archived friend-game positions to FEN (API only — worker never hits Supabase)."""
from __future__ import annotations

import json

import chess
from fastapi import HTTPException, status
from supabase import Client


def _parse_move_history(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        return json.loads(raw) if raw else []
    return list(raw)


def fen_at_ply(move_history: list[str], ply: int) -> str:
    """Half-move ply: 0 = start, N = after N half-moves applied."""
    if ply > len(move_history):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"ply {ply} exceeds move count {len(move_history)}",
        )
    board = chess.Board()
    for san in move_history[:ply]:
        try:
            board.push_san(san)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid move in archive: {e}",
            ) from e
    return board.fen()


def load_completed_game_fen(
    supabase: Client,
    *,
    game_id: str,
    ply: int,
    user_id: str,
) -> tuple[str, str, int]:
    """
    Load completed_games row, verify participant, return (fen, source_game_id, source_ply).
    """
    try:
        res = (
            supabase.table("completed_games")
            .select("game_id, white_player_id, black_player_id, move_history")
            .eq("game_id", game_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not load completed game",
        ) from e

    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    row = rows[0]
    wid = str(row.get("white_player_id") or "")
    bid = row.get("black_player_id")
    bid_str = str(bid) if bid is not None else None
    if user_id != wid and user_id != bid_str:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    moves = _parse_move_history(row.get("move_history"))
    fen = fen_at_ply(moves, ply)
    return fen, game_id, ply
