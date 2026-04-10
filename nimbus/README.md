# Nimbus — React Native chess app

React Native (**CLI**, not Expo) client for the Board-App ecosystem: auth, Lichess, local and online play, puzzles, voice-enabled AI coach, and Redis-backed friend games with SSE updates.

> Active development: some flows and copy will evolve; the root [README.md](../README.md) describes the full stack for portfolio reviewers.

## Prerequisites

Before you begin, ensure you have completed the [React Native Environment Setup](https://reactnative.dev/docs/set-up-your-environment):

- **Node.js** v18 or higher
- **Watchman** (macOS)
- **JDK 17** (for Android)
- **Android Studio** with SDK (for Android)
- **Xcode** (for iOS, macOS only)
- **CocoaPods** (for iOS)

## Quick Start

### Install Dependencies

```bash
cd nimbus
npm install --legacy-peer-deps
```

> ⚠️ **Important**: This project requires `--legacy-peer-deps` flag for all npm install commands.

### iOS Setup (macOS only)

```bash
# Install CocoaPods dependencies
cd ios && pod install && cd ..
```

### Run the App

**Start Metro Bundler:**
```bash
npx react-native start --reset-cache
```

**In a new terminal, run on device/emulator:**

```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

## Package Management

When adding new packages, always use the legacy peer deps flag:

```bash
npm install <package-name> --legacy-peer-deps
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start Metro bundler |
| `npx react-native start --reset-cache` | Start Metro with cleared cache |
| `npx react-native run-android` | Build and run on Android |
| `npx react-native run-ios` | Build and run on iOS |
| `cd ios && pod install` | Install iOS CocoaPods |

## Project Structure

```
nimbus/
├── src/
│   ├── App.tsx                    # App entry point & navigation
│   ├── screens/                   # Screen components
│   │   ├── home.tsx               # Main game menu
│   │   ├── play.tsx               # Local chess game
│   │   ├── playMenu.tsx           # Lichess online play
│   │   ├── chessAI.tsx            # AI Coach (voice enabled)
│   │   ├── botGame.tsx            # Play vs computer
│   │   ├── puzzle.tsx             # Chess puzzles
│   │   ├── localGame.tsx          # Local multiplayer
│   │   ├── onlineGame.tsx         # Online game screen
│   │   ├── friendGame.tsx         # In-app friend games (Redis + SSE)
│   │   ├── onlineFriendGameHistory.tsx
│   │   ├── onlineFriendGameReview.tsx
│   │   ├── login.tsx              # Login screen
│   │   ├── register.tsx           # Registration
│   │   ├── userLogin.tsx          # Email/password login
│   │   └── settings.tsx           # App settings
│   ├── components/                # Reusable components
│   │   ├── game/
│   │   │   ├── ChessBoard.tsx     # Chess board UI
│   │   │   └── MoveHistory.tsx    # Move list display
│   │   ├── header.tsx             # App header
│   │   ├── GoogleSignInButton.tsx
│   │   ├── TimeSelector.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── ProtectedRoute.tsx
│   ├── contexts/                  # React contexts
│   │   ├── AuthContext.tsx        # Authentication state
│   │   └── LichessAuthContext.tsx # Lichess auth state
│   ├── services/                  # auth, activeFriendGame, local/online game history
│   ├── env.ts                     # `API_URL` / `LLM_API_URL` from `.env` (@env)
│   └── types/                     # TypeScript definitions (incl. `env.d.ts` for @env)
├── android/                       # Android native project
├── ios/                           # iOS native project
├── assets/                        # Images and static files
├── tamagui.config.ts              # Tamagui UI configuration
├── package.json
├── tsconfig.json
└── metro.config.js
```

## Features

### Authentication
- Google Sign-In
- Email/Password login
- Lichess OAuth2 integration

### Chess Gameplay
- Local games (pass and play)
- Play against computer bots
- Online play via Lichess
- Chess puzzle solving

### AI Chess Coach
- Voice input using device microphone
- Text-based chat
- Position analysis via FEN
- Opening and strategy advice
- Powered by Hugging Face LLMs

## Configuration

### API endpoints

Configure **`BASE_URL`** (Board-Backend) and optionally **`LLM_SERVICE_URL`** in `.env`. Both are read in [`src/env.ts`](src/env.ts) (`API_URL`, `LLM_API_URL`) so screens and services share one source of truth. If `LLM_SERVICE_URL` is omitted, the app derives the LLM host from `BASE_URL` with port **8001** (see `LLM_API_URL` in that file).

### Permissions

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

**iOS** (`ios/nimbus/Info.plist`):
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Used for voice commands to Chess AI assistant</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Used to understand your chess questions</string>
```

## Troubleshooting

### Metro Bundler Issues
```bash
# Clear cache and restart
npx react-native start --reset-cache
```

### iOS Build Fails
```bash
# Clean and reinstall pods
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### Android Build Fails
```bash
# Clean Android build
cd android
./gradlew clean
cd ..
```

### Dependency Conflicts
Always use `--legacy-peer-deps`:
```bash
npm install --legacy-peer-deps
```

## Development Notes

- This project uses **React Native CLI** (not Expo)
- UI components are built with **Tamagui**
- Navigation uses **React Navigation** with stack and tab navigators
- Chess logic powered by **chess.js**
- Icons from **react-native-vector-icons**

## Related documentation

- [Board-App README](../README.md) — monorepo overview and architecture
- [docs/api-routes.md](../docs/api-routes.md) — backend HTTP API
- [docs/complex-logic.md](../docs/complex-logic.md) — friend games, SSE, resume behavior
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Tamagui Docs](https://tamagui.dev/docs/intro/introduction)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [chess.js](https://github.com/jhlywa/chess.js)
