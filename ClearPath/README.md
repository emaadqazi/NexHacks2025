# ClearPath - Indoor Navigation for Blind Users

ClearPath is a React Native app built with Expo that provides indoor navigation assistance for blind and visually impaired users. The app uses camera vision, voice commands, and turn-by-turn navigation to help users navigate indoor spaces independently.

## 🎯 Project Overview

**Built with:** Expo SDK 52, TypeScript, React Native  
**Target Users:** Blind and visually impaired individuals  
**Core Features:**
- 📷 Real-time object detection using Overshoot API
- 🎤 Voice command input via LiveKit
- 🗺️ Indoor pathfinding and turn-by-turn navigation
- 🔊 Audio feedback for navigation guidance

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or newer)
- npm or yarn
- Expo Go app on your phone (iOS/Android)
- iOS Simulator or Android Emulator (optional)

### Installation

```bash
# Navigate to project directory
cd ClearPath

# Install dependencies
npm install

# Start the development server
npm start
```

### Running on Device/Emulator

**On Physical Device:**
1. Install Expo Go from App Store (iOS) or Play Store (Android)
2. Scan the QR code from the terminal with your phone
3. Grant camera and microphone permissions when prompted

**On iOS Simulator:**
```bash
npm run ios
```

**On Android Emulator:**
```bash
npm run android
```

---

## 🔑 API Key Setup

This project requires API keys for external services. Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Then add your API keys:

```env
# Overshoot API (for object detection)
OVERSHOOT_API_KEY=your_overshoot_api_key_here
OVERSHOOT_API_URL=https://api.overshoot.io/v1

# LiveKit (for voice input/output)
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
LIVEKIT_WS_URL=wss://your-livekit-instance.livekit.cloud
```

### Getting API Keys

**Overshoot API:**
1. Sign up at [overshoot.io](https://overshoot.io)
2. Create a new project
3. Copy your API key from the dashboard

**LiveKit:**
1. Sign up at [livekit.io](https://livekit.io)
2. Create a new project
3. Copy your API credentials from the settings

---

## 👥 Team Member Task Assignments

This project is structured for 4 developers to work simultaneously on different features:

### Team Member 1: Camera & Object Detection
**Files:** `src/services/CameraService.ts`

**Tasks:**
- [ ] Integrate Overshoot API for object detection
- [ ] Implement OCR for reading signs and room numbers
- [ ] Add obstacle detection in camera feed
- [ ] Optimize camera performance for real-time processing
- [ ] Handle camera permissions and errors gracefully

**Key Methods to Implement:**
- `startCamera()` - Initialize camera with proper settings
- `detectObjects()` - Process frames with Overshoot API
- `performOCR()` - Extract text from camera feed
- `detectObstacles()` - Identify obstacles in path

---

### Team Member 2: Voice Input/Output
**Files:** `src/services/VoiceService.ts`

**Tasks:**
- [ ] Set up LiveKit client connection
- [ ] Implement voice command recognition
- [ ] Add text-to-speech for navigation instructions
- [ ] Handle voice input errors and fallbacks
- [ ] Add haptic feedback for navigation cues

**Key Methods to Implement:**
- `startListening()` - Begin voice input capture
- `speak()` - Convert text to speech output
- `parseVoiceCommand()` - Parse and structure voice commands
- `provideHapticFeedback()` - Trigger haptic patterns

**Voice Commands to Support:**
- "Navigate to [destination]"
- "Where am I?"
- "Repeat instructions"
- "Stop navigation"
- "Help"

---

### Team Member 3: Navigation & Pathfinding
**Files:** `src/services/NavigationService.ts`, `src/utils/floorPlan.ts`

**Tasks:**
- [ ] Implement A* or Dijkstra pathfinding algorithm
- [ ] Generate turn-by-turn instructions
- [ ] Track user position along path
- [ ] Detect when user deviates from path
- [ ] Calculate optimal routes considering accessibility

**Key Methods to Implement:**
- `calculatePath()` - Find optimal route between points
- `navigateTo()` - Start navigation to destination
- `getNextInstruction()` - Generate next turn instruction
- `updatePosition()` - Track user location and deviation

**Navigation Instructions Types:**
- Straight ahead
- Turn left/right
- Go up/down stairs
- Take elevator
- You have arrived

---

### Team Member 4: UI/UX & Integration Testing
**Files:** `src/screens/HomeScreen.tsx`, `src/components/*`

**Tasks:**
- [ ] Integrate all services in HomeScreen
- [ ] Design accessible UI for blind users
- [ ] Test camera view performance
- [ ] Implement voice feedback flow
- [ ] Add error handling and user feedback
- [ ] Test on physical devices (iOS/Android)
- [ ] Optimize for battery life

**Components to Enhance:**
- `CameraView.tsx` - Camera display with overlays
- `VoiceButton.tsx` - Voice input trigger
- `NavigationUI.tsx` - Turn-by-turn display

**Testing Checklist:**
- [ ] Camera initializes properly
- [ ] Voice commands are recognized
- [ ] Navigation instructions are clear
- [ ] App works in various lighting conditions
- [ ] Battery consumption is reasonable
- [ ] Permissions are handled gracefully

---

## 📁 Project Structure

```
ClearPath/
├── src/
│   ├── services/          # Business logic services
│   │   ├── CameraService.ts       # Camera & object detection
│   │   ├── VoiceService.ts        # Voice input/output
│   │   ├── NavigationService.ts   # Pathfinding & guidance
│   │   └── LocationService.ts     # Position tracking
│   │
│   ├── components/        # Reusable UI components
│   │   ├── CameraView.tsx         # Camera display
│   │   ├── VoiceButton.tsx        # Voice input button
│   │   └── NavigationUI.tsx       # Navigation instructions
│   │
│   ├── screens/          # Main app screens
│   │   ├── HomeScreen.tsx         # Main navigation screen
│   │   └── MappingScreen.tsx      # Building mapper (future)
│   │
│   ├── types/            # TypeScript definitions
│   │   └── index.ts               # All type definitions
│   │
│   ├── utils/            # Helper functions
│   │   └── floorPlan.ts           # Floor plan data & utils
│   │
│   └── assets/           # Static assets
│       └── sample-floorplan.json  # Example building layout
│
├── App.tsx               # Main app entry point
├── app.json             # Expo configuration
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript config
```

---

## 🧪 Testing Guide

### Testing on Expo Go

1. **Camera Test:**
   - Open app and grant camera permission
   - Verify camera feed displays
   - Point at objects to test detection (once implemented)

2. **Voice Test:**
   - Tap the voice button
   - Grant microphone permission
   - Speak a navigation command
   - Verify audio feedback works

3. **Navigation Test:**
   - Start navigation to a test destination
   - Follow turn-by-turn instructions
   - Verify instructions are clear and timely

### Testing Voice Commands

Example commands to test:
- "Navigate to Conference Room 101"
- "Take me to the restroom"
- "Where am I?"
- "Stop navigation"
- "Repeat last instruction"

---

## 🔧 Development Tips

### Working on Features Simultaneously

Each team member can work on their assigned service independently:

```bash
# Create a feature branch for your work
git checkout -b feature/camera-integration  # Team Member 1
git checkout -b feature/voice-livekit      # Team Member 2
git checkout -b feature/navigation-algo    # Team Member 3
git checkout -b feature/ui-testing         # Team Member 4
```

### Running Type Checks

```bash
npm run tsc --noEmit
```

### Debugging

1. Open React Native Debugger
2. Shake device to open dev menu
3. Select "Debug Remote JS"
4. Check console for logs

---

## 📦 Dependencies

### Core Dependencies
- `expo` - Expo framework
- `react-native` - React Native core
- `typescript` - TypeScript support

### Feature Dependencies
- `expo-camera` - Camera access
- `expo-av` - Audio/voice functionality
- `@react-navigation/native` - Navigation
- `livekit-client` - Voice processing

### Future Dependencies (to be added)
- `react-native-dotenv` - Environment variables
- `@react-native-async-storage/async-storage` - Local storage
- `react-native-haptic-feedback` - Haptic feedback

---

## 🗺️ Sample Floor Plan

A sample floor plan is included in `src/assets/sample-floorplan.json`. This represents a simple office building layout with:
- Main entrance
- Lobby
- Elevator
- Restroom
- Conference rooms
- Emergency exits

You can use this as a template for adding new buildings.

---

## 🐛 Troubleshooting

### Camera not working
- Ensure camera permissions are granted in device settings
- Restart the Expo app
- Check that camera hardware is available

### Voice commands not recognized
- Check microphone permissions
- Ensure internet connection (LiveKit requires network)
- Verify API keys are set correctly

### Navigation not starting
- Check that floor plan data is loaded
- Verify destination exists in floor plan
- Check console for errors

---

## 📝 Next Steps

### Immediate Tasks
1. Set up API keys for Overshoot and LiveKit
2. Test basic app functionality on a physical device
3. Team members begin implementation on assigned services
4. Schedule daily standups to sync progress

### Future Features
- [ ] Multi-floor navigation
- [ ] Building mapper tool for creating new floor plans
- [ ] Offline mode with cached floor plans
- [ ] AR mode for enhanced navigation
- [ ] Community-contributed building maps
- [ ] Integration with building management systems

---

## 📄 License

MIT License - feel free to use this project for educational purposes.

---

## 🤝 Contributing

This is a hackathon project for NexHacks 2025. Team members should:
1. Create feature branches for their work
2. Write clean, documented code
3. Test thoroughly before merging
4. Ask for help when stuck!

---

## 💬 Support

For questions or issues, reach out to your team members or create an issue in the repository.

**Good luck, team! Let's build something amazing! 🚀**
