from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from loguru import logger
from huggingface_hub import InferenceClient
import os

from schemas import (
    ChatRequest,
    ChatResponse,
    ChessAnalysisRequest,
    ChessAnalysisResponse,
    HealthResponse,
    MessageRole,
    MoveCommandRequest,
    MoveCommandResponse,
    ParsedMove,
)
import re
import json

# Load environment variables
load_dotenv()

# Configure logger
logger.add("llm_service.log", rotation="10 MB", level="DEBUG")

# Initialize FastAPI app
app = FastAPI(
    title="Board LLM Service",
    description="LLM service for Board Application using Hugging Face",
    version="0.1.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hugging Face configuration
HF_API_TOKEN = os.getenv("HF_API_TOKEN")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")

# Initialize Hugging Face client
hf_client: InferenceClient | None = None


def get_hf_client() -> InferenceClient:
    """Get or create the Hugging Face inference client."""
    global hf_client
    if hf_client is None:
        if not HF_API_TOKEN:
            logger.warning("HF_API_TOKEN not set. Some models may not be accessible.")
        hf_client = InferenceClient(token=HF_API_TOKEN)
    return hf_client


def format_messages_for_hf(messages: list) -> str:
    """Format chat messages into a prompt string for Hugging Face models."""
    formatted = ""
    for msg in messages:
        if msg.role == MessageRole.SYSTEM:
            formatted += f"<|system|>\n{msg.content}\n"
        elif msg.role == MessageRole.USER:
            formatted += f"<|user|>\n{msg.content}\n"
        elif msg.role == MessageRole.ASSISTANT:
            formatted += f"<|assistant|>\n{msg.content}\n"
    formatted += "<|assistant|>\n"
    return formatted


@app.get("/", response_model=dict)
async def root():
    """Root endpoint."""
    return {"message": "Board LLM Service is running"}


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    try:
        client = get_hf_client()
        return HealthResponse(
            status="healthy",
            model_loaded=client is not None,
            version="0.1.0",
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return HealthResponse(
            status="unhealthy",
            model_loaded=False,
            version="0.1.0",
        )


@app.post("/chat", response_model=ChatResponse)
async def chat_completion(request: ChatRequest):
    """
    Generate a chat completion using Hugging Face models.
    
    This endpoint accepts a list of messages and returns a generated response.
    """
    try:
        client = get_hf_client()
        model = request.model or DEFAULT_MODEL
        
        logger.info(f"Chat request received for model: {model}")
        logger.debug(f"Messages: {request.messages}")
        
        # Format messages for the model
        prompt = format_messages_for_hf(request.messages)
        
        # Generate response using Hugging Face Inference API
        response = client.text_generation(
            prompt,
            model=model,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            do_sample=True,
            return_full_text=False,
        )
        
        logger.info(f"Chat response generated successfully")
        
        return ChatResponse(
            content=response.strip(),
            model=model,
            usage=None,  # HF doesn't always return usage stats
        )
        
    except Exception as e:
        logger.error(f"Error generating chat completion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating response: {str(e)}",
        )


@app.post("/analyze-chess", response_model=ChessAnalysisResponse)
async def analyze_chess_position(request: ChessAnalysisRequest):
    """
    Analyze a chess position using LLM.
    
    Provides natural language analysis of chess positions, including
    strategic insights, tactical suggestions, and move recommendations.
    """
    try:
        client = get_hf_client()
        
        logger.info(f"Chess analysis request for FEN: {request.fen}")
        
        # Construct analysis prompt
        system_prompt = """You are an expert chess analyst. Analyze chess positions 
        and provide clear, insightful commentary. Consider tactical and strategic elements,
        piece activity, king safety, and pawn structure. Suggest candidate moves when appropriate."""
        
        analysis_context = f"Position (FEN): {request.fen}"
        if request.move_history:
            analysis_context += f"\nMove history: {', '.join(request.move_history)}"
        analysis_context += f"\nAnalysis type: {request.analysis_type}"
        
        user_prompt = f"""Please analyze this chess position:

{analysis_context}

Provide:
1. Position assessment
2. Key features and imbalances
3. Suggested candidate moves with brief explanations"""
        
        # Format as chat messages
        prompt = f"""<|system|>
{system_prompt}
<|user|>
{user_prompt}
<|assistant|>
"""
        
        response = client.text_generation(
            prompt,
            model=DEFAULT_MODEL,
            max_new_tokens=1024,
            temperature=0.5,
            top_p=0.9,
            do_sample=True,
            return_full_text=False,
        )
        
        logger.info("Chess analysis generated successfully")
        
        return ChessAnalysisResponse(
            analysis=response.strip(),
            suggested_moves=None,  # Could be parsed from response
            evaluation=None,
        )
        
    except Exception as e:
        logger.error(f"Error analyzing chess position: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing position: {str(e)}",
        )


@app.post("/parse-move", response_model=MoveCommandResponse)
async def parse_move_command(request: MoveCommandRequest):
    """
    Parse a natural language move command into a structured chess move.
    
    Examples of supported commands:
    - "move knight to f3"
    - "pawn to e4"
    - "castle kingside" / "castle queenside"
    - "queen takes on d5"
    - "bishop to b5"
    - "e4" (direct algebraic notation)
    - "knight f3" / "Nf3"
    """
    try:
        client = get_hf_client()
        command = request.command.lower().strip()
        
        logger.info(f"Parsing move command: '{command}' for position: {request.current_fen}")
        
        # First, try to parse common patterns directly (faster than LLM)
        parsed = try_direct_parse(command)
        if parsed:
            logger.info(f"Direct parse successful: {parsed}")
            return MoveCommandResponse(
                success=True,
                parsed_move=parsed,
                explanation=f"Parsed move: {parsed.move_san or parsed.to_square}",
                confidence=0.95,
            )
        
        # Use LLM for more complex/ambiguous commands
        system_prompt = """You are a chess move parser. Given a natural language command, extract the chess move.
        
IMPORTANT: Respond ONLY with a JSON object, no other text. Use this exact format:
{
    "success": true/false,
    "move_san": "Nf3" or null,
    "from_square": "g1" or null,
    "to_square": "f3" or null,
    "piece": "knight/bishop/rook/queen/king/pawn" or null,
    "is_castling": true/false,
    "castling_side": "kingside/queenside" or null,
    "promotion": "queen/rook/bishop/knight" or null,
    "explanation": "brief explanation"
}

Chess piece names: king, queen, rook, bishop, knight, pawn
Squares: a1-h8
Castling: O-O (kingside), O-O-O (queenside)"""

        user_prompt = f"""Parse this chess command: "{request.command}"
Current position (FEN): {request.current_fen}
Player color: {request.player_color}

Respond with JSON only."""

        prompt = f"<|system|>\n{system_prompt}\n<|user|>\n{user_prompt}\n<|assistant|>\n"
        
        response = client.text_generation(
            prompt,
            model=DEFAULT_MODEL,
            max_new_tokens=256,
            temperature=0.1,  # Low temperature for more deterministic output
            top_p=0.9,
            do_sample=True,
            return_full_text=False,
        )
        
        logger.debug(f"LLM response: {response}")
        
        # Parse the JSON response
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                result = json.loads(json_match.group())
                
                parsed_move = ParsedMove(
                    move_san=result.get("move_san"),
                    from_square=result.get("from_square"),
                    to_square=result.get("to_square"),
                    piece=result.get("piece"),
                    is_castling=result.get("is_castling", False),
                    castling_side=result.get("castling_side"),
                    promotion=result.get("promotion"),
                )
                
                # Generate UCI notation if we have from/to squares
                if parsed_move.from_square and parsed_move.to_square:
                    uci = f"{parsed_move.from_square}{parsed_move.to_square}"
                    if parsed_move.promotion:
                        uci += parsed_move.promotion[0].lower()
                    parsed_move.move_uci = uci
                
                return MoveCommandResponse(
                    success=result.get("success", True),
                    parsed_move=parsed_move,
                    explanation=result.get("explanation", "Move parsed by AI"),
                    confidence=0.8,
                )
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response: {e}")
        
        return MoveCommandResponse(
            success=False,
            parsed_move=None,
            explanation="Could not understand the move command. Try saying something like 'knight to f3' or 'castle kingside'.",
            confidence=0.0,
        )
        
    except Exception as e:
        logger.error(f"Error parsing move command: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error parsing move: {str(e)}",
        )


def try_direct_parse(command: str) -> ParsedMove | None:
    """Try to parse common move patterns directly without LLM."""
    command = command.lower().strip()
    
    # Castling patterns
    if any(x in command for x in ["castle king", "castles king", "king side castle", "short castle", "o-o"]):
        if "queen" not in command and "long" not in command:
            return ParsedMove(
                move_san="O-O",
                is_castling=True,
                castling_side="kingside",
                piece="king",
            )
    
    if any(x in command for x in ["castle queen", "castles queen", "queen side castle", "long castle", "o-o-o"]):
        return ParsedMove(
            move_san="O-O-O",
            is_castling=True,
            castling_side="queenside",
            piece="king",
        )
    
    # Direct algebraic notation (e.g., "e4", "Nf3", "Bxc6")
    san_pattern = r'^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(=[QRBN])?(\+|#)?$'
    san_match = re.match(san_pattern, command.replace(" ", ""), re.IGNORECASE)
    if san_match:
        return ParsedMove(
            move_san=command.replace(" ", "").upper() if command[0].upper() in "KQRBN" else command.replace(" ", ""),
            to_square=san_match.group(5),
        )
    
    # Piece name mappings
    piece_map = {
        "knight": "N", "horse": "N",
        "bishop": "B",
        "rook": "R", "castle": "R", "tower": "R",
        "queen": "Q",
        "king": "K",
        "pawn": "",
    }
    
    # Pattern: "[piece] to [square]" or "move [piece] to [square]"
    move_pattern = r'(?:move\s+)?(\w+)\s+(?:to\s+)?([a-h][1-8])'
    match = re.search(move_pattern, command)
    if match:
        piece_name = match.group(1)
        to_square = match.group(2)
        
        piece_letter = piece_map.get(piece_name, "")
        if piece_letter is not None or piece_name in ["pawn", "a", "b", "c", "d", "e", "f", "g", "h"]:
            san = f"{piece_letter}{to_square}" if piece_letter else to_square
            return ParsedMove(
                move_san=san,
                to_square=to_square,
                piece=piece_name if piece_name in piece_map else "pawn",
            )
    
    # Pattern: "[piece] takes [square]" or "[piece] captures [square]"
    capture_pattern = r'(\w+)\s+(?:takes?|captures?|x)\s+(?:on\s+)?([a-h][1-8])'
    match = re.search(capture_pattern, command)
    if match:
        piece_name = match.group(1)
        to_square = match.group(2)
        
        piece_letter = piece_map.get(piece_name, "")
        if piece_letter is not None:
            san = f"{piece_letter}x{to_square}" if piece_letter else f"x{to_square}"
            return ParsedMove(
                move_san=san,
                to_square=to_square,
                piece=piece_name if piece_name in piece_map else "pawn",
            )
    
    # Simple square only (for pawn moves): "e4", "d5"
    square_pattern = r'^([a-h][1-8])$'
    match = re.match(square_pattern, command.strip())
    if match:
        return ParsedMove(
            move_san=match.group(1),
            to_square=match.group(1),
            piece="pawn",
        )
    
    return None


@app.get("/models")
async def list_available_models():
    """List commonly used models for chess analysis and chat."""
    return {
        "recommended_models": [
            {
                "id": "mistralai/Mistral-7B-Instruct-v0.3",
                "description": "Fast, capable instruction-tuned model",
                "type": "chat",
            },
            {
                "id": "meta-llama/Llama-3.2-3B-Instruct",
                "description": "Compact but powerful Llama model",
                "type": "chat",
            },
            {
                "id": "microsoft/Phi-3-mini-4k-instruct",
                "description": "Efficient small model for quick responses",
                "type": "chat",
            },
            {
                "id": "HuggingFaceH4/zephyr-7b-beta",
                "description": "Well-tuned chat model",
                "type": "chat",
            },
        ],
        "default_model": DEFAULT_MODEL,
    }


# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("llm_service:app", host="0.0.0.0", port=8001, reload=True)

