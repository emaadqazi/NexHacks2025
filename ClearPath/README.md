# ClearPath - Indoor Navigation for Everyone

A web-based indoor navigation app using real-time AI object detection to assist visually impaired users.

## Features

- **Real-time Object Detection**: Uses Overshoot AI to identify doors, walls, signs, stairs, etc.
- **Voice Announcements**: Speaks detected objects and navigation guidance
- **Web-based**: Runs in any modern browser (iPhone Safari, Chrome, etc.)
- **No App Store Required**: Access via URL - works like a PWA

## Tech Stack

- **Frontend**: React (Expo Web)
- **AI Vision**: Overshoot SDK (WebRTC-based real-time detection)
- **Speech**: Web Speech API

## Quick Start

### 1. Install dependencies

```bash
cd ClearPath
npm install
```

### 2. Set up environment variables

Create a `.env` file:

```env
EXPO_PUBLIC_OVERSHOOT_API_KEY=your_api_key_here
EXPO_PUBLIC_OVERSHOOT_API_URL=https://cluster1.overshoot.ai/api/v0.2
```

Get your API key from [Overshoot Platform](https://overshoot.ai).

### 3. Run the app

**For iPhone testing (with HTTPS tunnel):**

```bash
npm run tunnel
```

Open the tunnel URL on your iPhone Safari.

**For local development:**

```bash
npm start
```

## Testing on iPhone

1. Make sure your Mac and iPhone are on the same WiFi
2. Run `npm run tunnel`
3. Wait for the tunnel URL (looks like `https://abc123.ngrok.io`)
4. Open that URL in Safari on your iPhone
5. Grant camera permission when prompted
6. Tap "Start Navigation" to begin detection

## Project Structure

```
ClearPath/
├── src/
│   ├── components/
│   │   └── WebCameraView.tsx   # Browser camera component
│   ├── hooks/
│   │   └── useOvershoot.ts     # Overshoot SDK hook
│   ├── screens/
│   │   └── HomeScreen.tsx      # Main UI
│   ├── services/
│   │   └── OvershootService.ts # AI detection service
│   └── types/
│       └── index.ts            # TypeScript types
├── App.tsx                      # App entry point
├── app.json                     # Expo config
└── package.json                 # Dependencies
```

## NexHacks 2025

Built for NexHacks 2025 hackathon.
