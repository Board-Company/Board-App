from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    """Represents a single message in a conversation."""
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    """Request body for chat completions."""
    messages: List[ChatMessage]
    model: Optional[str] = Field(
        default="mistralai/Mistral-7B-Instruct-v0.3",
        description="Hugging Face model ID to use"
    )
    max_tokens: Optional[int] = Field(
        default=512,
        ge=1,
        le=4096,
        description="Maximum number of tokens to generate"
    )
    temperature: Optional[float] = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature"
    )
    top_p: Optional[float] = Field(
        default=0.9,
        ge=0.0,
        le=1.0,
        description="Top-p (nucleus) sampling"
    )


class ChatResponse(BaseModel):
    """Response body for chat completions."""
    content: str
    model: str
    usage: Optional[dict] = None


class ChessAnalysisRequest(BaseModel):
    """Request for chess position analysis."""
    fen: str = Field(..., description="FEN notation of the chess position")
    move_history: Optional[List[str]] = Field(
        default=None,
        description="List of moves in algebraic notation"
    )
    analysis_type: Optional[str] = Field(
        default="general",
        description="Type of analysis: 'general', 'tactical', 'strategic', 'endgame'"
    )


class ChessAnalysisResponse(BaseModel):
    """Response for chess position analysis."""
    analysis: str
    suggested_moves: Optional[List[str]] = None
    evaluation: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model_loaded: bool
    version: str


class MoveCommandRequest(BaseModel):
    """Request to parse a move command from natural language."""
    command: str = Field(..., description="Natural language move command (e.g., 'move knight to f3', 'castle kingside')")
    current_fen: str = Field(..., description="Current board position in FEN notation")
    player_color: Optional[str] = Field(default="white", description="Player's color: 'white' or 'black'")


class ParsedMove(BaseModel):
    """A parsed chess move."""
    move_san: Optional[str] = Field(None, description="Move in Standard Algebraic Notation (e.g., 'Nf3', 'e4', 'O-O')")
    move_uci: Optional[str] = Field(None, description="Move in UCI format (e.g., 'g1f3', 'e2e4')")
    from_square: Optional[str] = Field(None, description="Source square (e.g., 'g1')")
    to_square: Optional[str] = Field(None, description="Destination square (e.g., 'f3')")
    piece: Optional[str] = Field(None, description="Piece being moved (e.g., 'knight', 'pawn')")
    promotion: Optional[str] = Field(None, description="Promotion piece if applicable")
    is_castling: bool = Field(default=False, description="Whether this is a castling move")
    castling_side: Optional[str] = Field(None, description="'kingside' or 'queenside' if castling")


class MoveCommandResponse(BaseModel):
    """Response from parsing a move command."""
    success: bool = Field(..., description="Whether a valid move was parsed")
    parsed_move: Optional[ParsedMove] = Field(None, description="The parsed move details")
    explanation: str = Field(..., description="Explanation or error message")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confidence in the parsed move")
    alternative_moves: Optional[List[str]] = Field(None, description="Alternative interpretations if ambiguous")

