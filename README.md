# Board-App - Smart Chess Board Application

![Version](https://img.shields.io/badge/Version-0.1.0-blue)
![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-green)

---

## Description

Board-App is a comprehensive smart chess board ecosystem that combines hardware, mobile, and AI technologies to create an enhanced chess playing experience. The project consists of a React Native mobile application (Nimbus), a FastAPI backend server, ESP32-based firmware for physical board integration, and an LLM-powered chess coaching assistant.

### Key Features

- **Voice-Controlled Chess** - Speak your moves naturally: "Knight to f3", "Castle kingside", "Queen takes d5"
- **AI Chess Coach** - Get real-time coaching, position analysis, and strategy advice
- **Online Play** - Play against opponents worldwide via Lichess integration
- **Smart Board Integration** - Connect to a physical chess board with automatic piece detection
- **Puzzle Training** - Improve tactical skills with chess puzzles
- **Multi-Platform** - Available on both iOS and Android

## Voice-Controlled Chess AI

The Chess AI Coach allows you to play chess using natural language voice commands:

**Supported Commands:**
- "Move knight to f3" / "Knight f3"
- "Pawn to e4" / "e4"
- "Castle kingside" / "Castle queenside"
- "Queen takes d5" / "Bishop captures c6"
- "Promote to queen"

The AI parses your voice input, validates the move against the current position, and executes it on the board - all hands-free!

**Additional AI Capabilities:**
- Position analysis and evaluation
- Opening recommendations
- Strategic advice tailored to your position
- Endgame guidance

## Hardware Prototype

The hardware prototype is **complete** and fully functional:

- **ESP32 Development Board** - Main microcontroller handling sensor data processing
- **Hall Effect Sensors** - Detect magnetic chess pieces on the board
- **16-Channel Analog Multiplexer** - Reads multiple sensors simultaneously
- **Real-time Detection** - Tracks piece positions with state detection (approaching, over, leaving)

The firmware implements multiplexer control, 12-bit ADC readings, noise reduction algorithms, and serial communication for seamless integration with the mobile app.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Mobile App | React Native (CLI), TypeScript, Tamagui |
| Backend | Python, FastAPI, Supabase |
| LLM Service | Python, Hugging Face, FastAPI |
| Firmware | C++, PlatformIO, ESP32 |
| Voice Recognition | @react-native-voice/voice |
| Authentication | JWT, Google OAuth, Lichess OAuth2 |

## Requirements

- **Node.js** v18+ (https://nodejs.org/)
- **Python** 3.12+ (https://www.python.org/downloads/)
- **Poetry** for Python dependency management
- **React Native CLI** (not Expo)
- **Android Studio** or **Xcode** for mobile development
- **PlatformIO** for firmware development (optional)

## Quick Start

### 1. Clone & Setup

```bash
git clone <repository-url>
cd Board-App
```

### 2. Start Backend Server

```bash
cd Board-Backend
python -m poetry install
poetry run python api.py 
```

### 3. Start LLM Service

```bash
cd Board-LLM
python -m poetry install
python -m poetry run python llm_service.py
```

### 4. Run Mobile App

```bash
cd nimbus
npm install --legacy-peer-deps

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

## Project Structure

```
Board-App/
├── Board-Backend/                 # FastAPI Backend Server
│   ├── api.py                     # Authentication, Lichess OAuth, user management
│   ├── auth.py                    # JWT & OAuth logic
│   └── schemas.py                 # Pydantic models
│
├── Board-Firmware/                # ESP32 Smart Board Firmware
│   └── src/main.cpp               # Hall sensor reading, multiplexer control
│
├── Board-LLM/                     # AI Chess Coach Service
│   ├── llm_service.py             # Chat, analysis, move parsing endpoints
│   └── schemas.py                 # Request/response models
│
└── nimbus/                        # React Native Mobile App
    └── src/
        ├── screens/
        │   ├── chessAI.tsx        # Voice-controlled AI Coach
        │   ├── playMenu.tsx       # Lichess online play
        │   ├── play.tsx           # Local games
        │   └── puzzle.tsx         # Puzzle training
        ├── components/
        │   └── game/ChessBoard.tsx
        └── contexts/              # Auth & Lichess contexts
```

## API Endpoints

### Backend Server (Port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/token` | POST | User login |
| `/register` | POST | User registration |
| `/auth/google` | POST | Google OAuth |
| `/auth/lichess/login` | GET | Lichess OAuth |
| `/users/me` | GET | Current user info |
| `/users/lichess-info` | GET | Linked Lichess account |

### LLM Service (Port 8001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/parse-move` | POST | Parse voice/text move commands |
| `/chat` | POST | AI coaching chat |
| `/analyze-chess` | POST | Position analysis |
| `/models` | GET | Available AI models |

## Environment Variables

### Board-Backend (.env)

Create `Board-Backend/.env` (copy from `Board-Backend/.env.example`). Required for the backend:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
GOOGLE_CLIENT_ID=your_google_client_id
SECRET_KEY=your_jwt_secret
```

See [Setting up Supabase](#setting-up-supabase) below for how to get `SUPABASE_URL` and `SUPABASE_KEY`.

---

## Setting up Supabase

The backend uses Supabase for user accounts and Lichess linking. If your project was deprecated or you need a fresh database:

### 1. Create a new Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** → choose org, name, database password, region.
3. Wait for the project to be ready.

### 2. Create the tables

1. In the Supabase dashboard, open **SQL Editor**.
2. **New query**.
3. Copy the contents of `Board-Backend/supabase_schema.sql` and run it.

This creates the `users` and `lichess_users` tables the backend expects.

### 3. Get your URL and key

1. In the dashboard, go to **Project Settings** (gear) → **API**.
2. Copy **Project URL** → use as `SUPABASE_URL`.
3. Copy **service_role** key (under "Project API keys") → use as `SUPABASE_KEY`.  
   Use the service role so the backend can read/write without Row Level Security. Keep this key secret.

### 4. Configure the backend

In `Board-Backend/.env` set:

```bash
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...your_service_role_key
SECRET_KEY=any_long_random_string_for_jwt_signing
```

Then start the backend:

```bash
cd Board-Backend
python -m poetry install
poetry run python api.py
```

### 5. (Optional) Restore from your old cluster backup

If you have a Supabase backup (e.g. `db_cluster-13-06-2025@04-25-42.backup (1).gz`) and want to bring over existing users and Lichess links:

1. Create the tables first (step 2 above) with `Board-Backend/supabase_schema.sql`.
2. In the Supabase SQL Editor, run **`Board-Backend/restore_from_backup.sql`**.

That file restores the users and `lichess_users` rows extracted from the backup. **Note:** Lichess access tokens from the backup may be expired; users can re-link their Lichess account in the app.

### Board-LLM (.env)
```
HF_API_TOKEN=your_huggingface_token
DEFAULT_MODEL=mistralai/Mistral-7B-Instruct-v0.3
```

## Mobile App Permissions

**iOS** - Add to `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Voice commands for chess moves</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Speech recognition for move input</string>
```

**Android** - Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## License

This project is proprietary software. All rights reserved.
