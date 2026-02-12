# Board-LLM

LLM service for Board Application using Hugging Face models.

## Setup

1. Install dependencies using Poetry:

```bash
cd Board-LLM
python -m poetry install
```

2. Create a `.env` file with your Hugging Face API token:

```env
HF_API_TOKEN=your_huggingface_api_token_here
DEFAULT_MODEL=mistralai/Mistral-7B-Instruct-v0.3
```

Get your token from: https://huggingface.co/settings/tokens

## Running the Service

```bash
python -m poetry run python llm_service.py
```

The service will start on `http://localhost:8001`

## API Endpoints

### Health Check
- `GET /health` - Check service health and model status

### Chat Completion
- `POST /chat` - Generate chat completions

```json
{
  "messages": [
    {"role": "user", "content": "What's the best opening for beginners?"}
  ],
  "model": "mistralai/Mistral-7B-Instruct-v0.3",
  "max_tokens": 512,
  "temperature": 0.7
}
```

### Chess Position Analysis
- `POST /analyze-chess` - Analyze a chess position

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "move_history": ["e4"],
  "analysis_type": "general"
}
```

### Available Models
- `GET /models` - List recommended models for inference

## Supported Models

The service supports any model available on Hugging Face Hub. Recommended models:

- `mistralai/Mistral-7B-Instruct-v0.3` - Fast, capable instruction-tuned model
- `meta-llama/Llama-3.2-3B-Instruct` - Compact but powerful
- `microsoft/Phi-3-mini-4k-instruct` - Efficient small model
- `HuggingFaceH4/zephyr-7b-beta` - Well-tuned chat model

