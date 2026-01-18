# Wispr Flow API Setup Guide

This guide explains how to set up the Wispr Flow API for speech recognition in ClearPath.

## Overview

Wispr Flow is used to convert user speech into text transcripts. The app records audio using Expo's `expo-av` and sends it to Wispr Flow API for transcription, then parses the transcript into structured location data.

## Setup Steps

### Option 1: Using Wispr Flow Cloud API (Recommended for MVP)

1. **Sign up for Wispr Flow**
   - Go to [Wispr Flow](https://wispr.ai) or visit their API documentation
   - Sign up for an account
   - Navigate to your dashboard/settings

2. **Get your API Key**
   - In the Wispr Flow dashboard, find your API key
   - Copy the API key (it will look like: `sk-...` or similar)

3. **Configure the API Key**
   - Open `src/services/WisprFlowService.ts`
   - Find this line:
     ```typescript
     this.apiKey = process.env.WISPR_FLOW_API_KEY || 'YOUR_WISPR_FLOW_API_KEY_HERE';
     ```
   - Replace `'YOUR_WISPR_FLOW_API_KEY_HERE'` with your actual API key:
     ```typescript
     this.apiKey = process.env.WISPR_FLOW_API_KEY || 'sk-your-actual-api-key-here';
     ```

### Option 2: Using Local Wispr Flow App (Mac)

If you have the Wispr Flow app installed on your Mac:

1. **Launch Wispr Flow Desktop App**
   - Open the Wispr Flow application
   - The app may provide a local API endpoint

2. **Update API Endpoint** (if using local API)
   - If using a local endpoint, you may need to update the `baseUrl` in `WisprFlowService.ts`
   - Default is: `https://platform-api.wisprflow.ai/api/v1/dash`
   - For local, it might be: `http://localhost:PORT/api/v1/dash` or similar

3. **Configure API Key**
   - Follow the same steps as Option 1
   - Use the API key provided by your local Wispr Flow app

## API Endpoint

The default Wispr Flow API endpoint is:
```
https://platform-api.wisprflow.ai/api/v1/dash/client_api
```

The service sends audio files (base64 encoded) to this endpoint for transcription.

## Testing

1. Run the app: `npm start`
2. Open the app in Expo Go
3. Tap "Start" on the landing page
4. On the Speech Input screen, tap the microphone button
5. Say: "I am in room 203 in Wean Hall at Carnegie Mellon University on floor 2, I want to go to the washroom."
6. Tap "Stop Recording"
7. The app will:
   - Send audio to Wispr Flow
   - Receive transcript
   - Parse into structured JSON
   - Fetch floor plan

## API Documentation

For more details about Wispr Flow API, visit:
- [Wispr Flow API Docs](https://api-docs.wisprflow.ai)
- [WebSocket API](https://api-docs.wisprflow.ai/websocket_api)
- [Request Schema](https://api-docs.wisprflow.ai/request_schema)

## Troubleshooting

### "Wispr Flow API error: 401"
- Your API key is invalid or not set correctly
- Check that you've replaced `'YOUR_WISPR_FLOW_API_KEY_HERE'` with your actual key

### "Wispr Flow API error: 403"
- Your API key doesn't have permission to access the API
- Check your Wispr Flow account status

### "Network request failed"
- Check your internet connection
- Verify the API endpoint URL is correct
- If using local Wispr Flow app, ensure it's running

### Audio not being recorded
- Grant microphone permissions when prompted
- Check device microphone is working in other apps

## Notes

- For MVP/hackathon, you can hardcode the API key in `WisprFlowService.ts`
- For production, use environment variables with `expo-constants` or `react-native-dotenv`
- The current implementation uses REST API. WebSocket streaming can be added later for real-time transcription
