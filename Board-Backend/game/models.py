from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class JoinGameRequest(BaseModel):
    game_id: Optional[str] = None
    invite_code: Optional[str] = None


class MoveRequestBody(BaseModel):
    san: str = Field(..., description="Standard algebraic notation, e.g. e4, Nf3")


class CreateGameResponse(BaseModel):
    game_id: str
    invite_code: str


class CompletedGameSummary(BaseModel):
    """Archived friend game row (Supabase) for the authenticated user."""

    id: str
    game_id: str
    white_player_id: str
    black_player_id: Optional[str] = None
    white_username: Optional[str] = None
    black_username: Optional[str] = None
    move_history: list[str]
    final_fen: str
    result: str
    finished_reason: Optional[str] = None
    started_at: str
    finished_at: str


class FriendGameState(BaseModel):
    game_id: str
    fen: str
    move_history: list[str]
    status: Literal["waiting", "active", "finished"]
    side_to_move: Literal["w", "b"]
    white_player_id: Optional[str] = None
    black_player_id: Optional[str] = None
    white_username: Optional[str] = None
    black_username: Optional[str] = None
    invite_code: Optional[str] = None
    result: Optional[str] = None
    finished_reason: Optional[str] = None
    created_at: str
    updated_at: str


# Legacy names kept for compatibility with earlier sketches
class MoveRequest(BaseModel):
    game_id: str
    move: str
    player_id: str
    timestamp: datetime


class GameState(BaseModel):
    game_id: str
    fen: str
    move_history: list[str]
    player_ids: list[str]
    status: str
    timestamp: datetime
