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
)

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

