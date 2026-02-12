# Nimbus - React Native Chess App

> ⚠️ **Work In Progress** - This app is under active development.

A React Native mobile application for the Board-App smart chess ecosystem. Built without Expo using React Native CLI.

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
│   ├── services/                  # API services
│   │   └── auth.tsx               # Auth API calls
│   ├── config/
│   │   └── constants.ts           # App constants
│   └── types/                     # TypeScript definitions
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

### API Endpoints

Update the service URLs in the relevant files:

- **Backend API**: `src/config/constants.ts`
- **LLM Service**: `src/screens/chessAI.tsx` (LLM_SERVICE_URL)

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

## Related Documentation

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Tamagui Docs](https://tamagui.dev/docs/intro/introduction)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [chess.js](https://github.com/jhlywa/chess.js)
