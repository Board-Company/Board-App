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

