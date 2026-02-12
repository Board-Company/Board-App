# Board-App - Smart Chess Board Application

> ⚠️ **Work In Progress** - This project is under active development. Features may be incomplete, unstable, or subject to change.

![Status](https://img.shields.io/badge/Status-In%20Development-yellow)
![Version](https://img.shields.io/badge/Version-0.1.0--alpha-blue)

---

## Description

Board-App is a comprehensive smart chess board ecosystem that combines hardware, mobile, and AI technologies to create an enhanced chess playing experience. The project consists of a React Native mobile application (Nimbus), a FastAPI backend server, ESP32-based firmware for physical board integration, and an LLM-powered chess coaching assistant.

The mobile application allows users to:
- Play chess against bots or online opponents via Lichess integration
- Solve chess puzzles to improve tactical skills
- Get real-time AI coaching and position analysis through voice or text
- Connect to a physical smart chess board for over-the-board play with digital tracking
- Authenticate via Google or traditional email/password

The backend handles user authentication, Lichess OAuth integration, and data persistence through Supabase. The firmware reads hall effect sensors on the physical board to detect piece positions, while the LLM service provides natural language chess analysis and coaching using Hugging Face models.

## Hardware Prototype

The hardware prototype is **complete** and fully functional. It consists of:

- **ESP32 Development Board** - Main microcontroller handling sensor data processing
- **Hall Effect Sensors** - Detect magnetic chess pieces on the board
- **16-Channel Analog Multiplexer (CD74HC4067)** - Expands ESP32's single ADC input to read multiple sensors
- **4-Channel Sensor Array** - Currently configured to read 4 hall sensors simultaneously

### Firmware Capabilities

The firmware (`Board-Firmware/src/main.cpp`) implements:

- ✅ **Multiplexer Control** - Switches between sensor channels automatically
- ✅ **Hall Sensor Reading** - Reads analog values from hall effect sensors via 12-bit ADC
- ✅ **State Detection** - Tracks magnet states: No Magnet, Approaching, Directly Over, Leaving
- ✅ **Data Processing** - Calculates averages and standard deviation for noise reduction
- ✅ **Serial Communication** - Outputs sensor values at 115200 baud for real-time monitoring
- ✅ **Threshold-Based Detection** - Configurable thresholds for different magnet proximity levels

The prototype successfully reads sensor data from multiple channels, processes it to detect piece positions, and outputs formatted data via serial communication. The hardware is ready for integration with the mobile application.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Mobile App | React Native (CLI), TypeScript, Tamagui |
| Backend | Python, FastAPI, Supabase |
| LLM Service | Python, Hugging Face, FastAPI |
| Firmware | C++, PlatformIO, ESP32 |
| Authentication | JWT, Google OAuth, Lichess OAuth2 |

## Requirements

- **Node.js** v18+ (https://nodejs.org/)
- **Python** 3.12+ (https://www.python.org/downloads/)
- **Poetry** for Python dependency management
- **React Native CLI** (not Expo)
- **Android Studio** or **Xcode** for mobile development
- **PlatformIO** for firmware development (optional)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Board-App
```

### 2. Backend Server Setup

```bash
cd Board-Backend

# Install dependencies using Poetry
python -m poetry install

# Create .env file with required variables
# SUPABASE_URL=your_supabase_url
# SUPABASE_KEY=your_supabase_key
# GOOGLE_CLIENT_ID=your_google_client_id
# SECRET_KEY=your_jwt_secret

# Run the server
python -m poetry run python api.py
```

The backend runs on `http://localhost:8000`

### 3. LLM Service Setup

```bash
cd Board-LLM

# Install dependencies using Poetry
python -m poetry install

# Create .env file
# HF_API_TOKEN=your_huggingface_token
# DEFAULT_MODEL=mistralai/Mistral-7B-Instruct-v0.3

# Run the LLM service
python -m poetry run python llm_service.py
```

The LLM service runs on `http://localhost:8001`

### 4. Mobile App Setup

```bash
cd nimbus

# Install dependencies (must use legacy-peer-deps)
npm install --legacy-peer-deps

# For iOS (macOS only)
cd ios && pod install && cd ..

# Run on Android
npx react-native run-android

# Run on iOS
npx react-native run-ios
```

See `nimbus/README.md` for detailed mobile development instructions.

### 5. Firmware Setup (Optional)

```bash
cd Board-Firmware

# Open with PlatformIO IDE or use CLI
pio run

# Upload to ESP32
pio run --target upload
```

## Running the Project

For full functionality, run the following in separate terminals:

**Terminal 1 - Backend Server:**
```bash
cd Board-Backend
python -m poetry run python api.py
```

**Terminal 2 - LLM Service:**
```bash
cd Board-LLM
python -m poetry run python llm_service.py
```

**Terminal 3 - Mobile App (Metro):**
```bash
cd nimbus
npx react-native start --reset-cache
```

**Terminal 4 - Mobile App (Build):**
```bash
cd nimbus
npx react-native run-android  # or run-ios
```

## Project Structure

```
Board-App/
├── Board-Backend/                 # FastAPI Backend Server
│   ├── api.py                     # Main API endpoints
│   ├── auth.py                    # Authentication logic
│   ├── schemas.py                 # Pydantic models
│   ├── pyproject.toml             # Poetry dependencies
│   └── Dockerfile                 # Container configuration
│
├── Board-Firmware/                # ESP32 Smart Board Firmware
│   ├── src/
│   │   └── main.cpp               # Hall sensor reading, multiplexer control, state tracking
│   ├── platformio.ini             # PlatformIO configuration
│   └── hall_sensor_data.csv       # Sensor calibration data
│
├── Board-LLM/                     # Hugging Face LLM Service
│   ├── llm_service.py             # FastAPI LLM endpoints
│   ├── schemas.py                 # Request/response models
│   ├── pyproject.toml             # Poetry dependencies
│   └── README.md                  # LLM service documentation
│
├── nimbus/                        # React Native Mobile App
│   ├── src/
│   │   ├── screens/               # App screens
│   │   │   ├── home.tsx           # Main menu
│   │   │   ├── play.tsx           # Local game screen
│   │   │   ├── playMenu.tsx       # Online play / Lichess
│   │   │   ├── chessAI.tsx        # AI Coach with voice input
│   │   │   ├── puzzle.tsx         # Puzzle solving
│   │   │   ├── botGame.tsx        # Play against bot
│   │   │   └── settings.tsx       # App settings
│   │   ├── components/            # Reusable components
│   │   │   ├── game/
│   │   │   │   ├── ChessBoard.tsx # Chess board renderer
│   │   │   │   └── MoveHistory.tsx
│   │   │   └── header.tsx
│   │   ├── contexts/              # React contexts
│   │   │   ├── AuthContext.tsx    # User authentication
│   │   │   └── LichessAuthContext.tsx
│   │   ├── services/              # API services
│   │   └── App.tsx                # App entry & navigation
│   ├── android/                   # Android native code
│   ├── ios/                       # iOS native code
│   ├── package.json               # NPM dependencies
│   └── README.md                  # Mobile app documentation
│
└── README.md                      # This file
```

## API Endpoints

### Backend Server (Port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/token` | POST | User login, returns JWT |
| `/register` | POST | User registration |
| `/users/me` | GET | Get current user info |
| `/auth/google` | POST | Google OAuth authentication |
| `/auth/lichess/login` | GET | Initiate Lichess OAuth |
| `/auth/lichess/callback` | GET | Lichess OAuth callback |
| `/users/lichess-info` | GET | Get linked Lichess account |
| `/health` | GET | Health check |

### LLM Service (Port 8001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Chat completion with LLM |
| `/analyze-chess` | POST | Analyze chess position (FEN) |
| `/models` | GET | List available models |
| `/health` | GET | Health check |

## Environment Variables

### Board-Backend (.env)
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
SECRET_KEY=your_jwt_secret_key
LICHESS_CLIENT_ID=your_lichess_client_id
LICHESS_REDIRECT_URI=your_redirect_uri
```

### Board-LLM (.env)
```
HF_API_TOKEN=your_huggingface_api_token
DEFAULT_MODEL=mistralai/Mistral-7B-Instruct-v0.3
```

## Troubleshooting

### Mobile App Issues
- Always use `--legacy-peer-deps` when installing npm packages
- Clear cache with `npx react-native start --reset-cache`
- For iOS: Run `cd ios && pod install` after adding native dependencies

### Backend Issues
- Ensure Supabase credentials are correct
- Check that all required tables exist in Supabase

### LLM Service Issues
- Verify Hugging Face API token has proper permissions
- Some models require accepting terms on Hugging Face website

## Known Issues

As this project is in active development, you may encounter:

- Incomplete features or placeholder functionality
- UI/UX inconsistencies across screens
- API endpoints that may change without notice
- Missing error handling in some areas
- Documentation that may not reflect latest changes

Please report issues via the project's issue tracker.

## Contributing

This project is currently in private development. Contribution guidelines will be added once the project reaches a more stable state.

## License

This project is proprietary software. All rights reserved.
