# Overshoot API Integration Guide

## Overview

This document provides a complete guide for integrating the Overshoot API with ClearPath's camera functionality to detect indoor objects (walls, trash cans, washroom signs, etc.) for blind user navigation assistance.

---

## Table of Contents

1. [API Setup Instructions](#1-api-setup-instructions)
2. [Target Objects for Detection](#2-target-objects-for-detection)
3. [Implementation Steps](#3-implementation-steps)
4. [Code Snippets](#4-code-snippets)
5. [Testing Checklist](#5-testing-checklist)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. API Setup Instructions

### Getting Your Overshoot API Key

1. **Sign up at Overshoot**
   - Visit [https://overshoot.ai](https://overshoot.ai)
   - Create a new account or sign in
   - Navigate to the Dashboard

2. **Create a New Project**
   - Click "New Project"
   - Name it "ClearPath Indoor Navigation"
   - Select "Object Detection" as the primary use case

3. **Get Your API Credentials**
   - Go to Project Settings > API Keys
   - Copy your API Key
   - Note the API endpoint URL

### Environment Configuration

Create a `.env` file in the ClearPath root directory (if not already present):

```env
# Overshoot API Configuration
OVERSHOOT_API_KEY=your_api_key_here
OVERSHOOT_API_URL=https://api.overshoot.ai/v1/detect
```

**Important:** Add `.env` to your `.gitignore` to keep your API key secure.

### Install Required Dependencies

```bash
cd ClearPath
npm install expo-file-system react-native-dotenv
```

Note: 
- `expo-file-system` is needed for handling image data when capturing frames
- `react-native-dotenv` is needed to load environment variables from .env file

### Configure Babel

Create `babel.config.js` in the project root:

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
        verbose: false,
      }]
    ]
  };
};
```

### Create TypeScript Types for Environment Variables

Create `src/types/env.d.ts`:

```typescript
declare module '@env' {
  export const OVERSHOOT_API_KEY: string;
  export const OVERSHOOT_API_URL: string;
  export const LIVEKIT_API_KEY: string;
  export const LIVEKIT_API_SECRET: string;
  export const LIVEKIT_WS_URL: string;
  export const NODE_ENV: string;
}
```

### Restart Metro Bundler

After configuring babel and adding .env variables, **you must restart the Metro bundler**:

```bash
# Stop the current Expo server (Ctrl+C)
# Then restart:
npx expo start --clear
```

---

## 2. Target Objects for Detection

### Primary Detection Targets

| Object Type | Priority | Description |
|-------------|----------|-------------|
| Wall | High | Boundaries and structural walls |
| Door | High | Doorways, entrances, exits |
| Washroom Sign | High | Restroom indicators |
| Exit Sign | High | Emergency exit markers |
| Stairs | High | Staircases (up/down) |
| Elevator | High | Elevator doors and buttons |
| Trash Can | Medium | Waste receptacles |
| Bench/Seat | Medium | Seating areas |
| Water Fountain | Medium | Drinking fountains |
| Person | Medium | People in the path |

### Detection Prompt Template

When calling the Overshoot API, use this prompt for indoor navigation:

```
Detect and identify the following objects in this indoor environment image:
- Walls and structural boundaries
- Doors (open or closed)
- Signs (washroom, exit, directional, informational)
- Stairs and elevators
- Obstacles (trash cans, benches, people)
- Floor transitions or level changes

For each detected object, provide:
1. Object label
2. Confidence score (0-1)
3. Position relative to camera (left, center, right)
4. Approximate distance category (near, medium, far)
```

---

## 3. Implementation Steps

### Step 1: Add Camera Ref for Frame Capture

Modify `src/screens/HomeScreen.tsx` to add a camera reference:

```typescript
import React, { useState, useRef } from 'react';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';

// Inside CameraScreen component:
const cameraRef = useRef<ExpoCameraView>(null);
```

### Step 2: Create OvershootService

Create a new file `src/services/OvershootService.ts`:

```typescript
/**
 * Overshoot API Service
 * Handles communication with Overshoot API for object detection
 */

const OVERSHOOT_API_URL = 'https://api.overshoot.ai/v1/detect';
const OVERSHOOT_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with env variable

interface DetectedObject {
  label: string;
  confidence: number;
  position: 'left' | 'center' | 'right';
  distance: 'near' | 'medium' | 'far';
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DetectionResponse {
  success: boolean;
  objects: DetectedObject[];
  processingTime: number;
  error?: string;
}

export class OvershootService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = OVERSHOOT_API_KEY;
    this.apiUrl = OVERSHOOT_API_URL;
  }

  /**
   * Send an image to Overshoot API for object detection
   * @param base64Image - Base64 encoded image string
   * @returns Detection results
   */
  async detectObjects(base64Image: string): Promise<DetectionResponse> {
    console.log('Sending image to Overshoot API...');

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          image: base64Image,
          prompt: `Detect indoor navigation objects: walls, doors, signs (washroom, exit), stairs, elevators, trash cans, obstacles, people. Return label, confidence, position (left/center/right), distance (near/medium/far).`,
          model: 'object-detection-v1',
          maxResults: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('Overshoot API Response:', JSON.stringify(data, null, 2));
      
      return {
        success: true,
        objects: data.detections || [],
        processingTime: data.processingTime || 0,
      };
    } catch (error) {
      console.error('Overshoot API Error:', error);
      return {
        success: false,
        objects: [],
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format detection results for console logging
   */
  formatResultsForLog(results: DetectionResponse): string {
    if (!results.success) {
      return `Detection failed: ${results.error}`;
    }

    if (results.objects.length === 0) {
      return 'No objects detected in frame';
    }

    let output = `\n=== OVERSHOOT DETECTION RESULTS ===\n`;
    output += `Processing time: ${results.processingTime}ms\n`;
    output += `Objects detected: ${results.objects.length}\n\n`;

    results.objects.forEach((obj, index) => {
      output += `${index + 1}. ${obj.label.toUpperCase()}\n`;
      output += `   Confidence: ${(obj.confidence * 100).toFixed(1)}%\n`;
      output += `   Position: ${obj.position}\n`;
      output += `   Distance: ${obj.distance}\n\n`;
    });

    output += `===================================\n`;
    return output;
  }
}

export default new OvershootService();
```

### Step 3: Add Scan Button to Camera Screen

Update `src/screens/HomeScreen.tsx` to add a "Scan" button:

```typescript
// Add state for scanning
const [isScanning, setIsScanning] = useState(false);
const [lastScanResult, setLastScanResult] = useState<string>('');

// Add scan function
const handleScan = async () => {
  if (!cameraRef.current || isScanning) return;
  
  setIsScanning(true);
  console.log('Starting scan...');
  
  try {
    // Capture frame
    const photo = await cameraRef.current.takePictureAsync({
      base64: true,
      quality: 0.5,
      skipProcessing: true,
    });
    
    if (photo?.base64) {
      console.log('Frame captured, sending to Overshoot...');
      
      // Send to Overshoot API
      const results = await OvershootService.detectObjects(photo.base64);
      
      // Log results
      const formattedResults = OvershootService.formatResultsForLog(results);
      console.log(formattedResults);
      setLastScanResult(formattedResults);
    }
  } catch (error) {
    console.error('Scan error:', error);
  } finally {
    setIsScanning(false);
  }
};
```

### Step 4: Update Camera View JSX

```typescript
{/* Add Scan Button next to Voice Button */}
<View style={styles.bottomOverlay}>
  <TouchableOpacity 
    style={[styles.scanButton, isScanning && styles.scanButtonDisabled]} 
    onPress={handleScan}
    disabled={isScanning}
  >
    <Text style={styles.scanButtonText}>
      {isScanning ? '🔄 Scanning...' : '🔍 Scan'}
    </Text>
  </TouchableOpacity>
  
  <TouchableOpacity style={styles.voiceButton}>
    <Text style={styles.voiceButtonText}>🎤 Tap to Speak</Text>
  </TouchableOpacity>
</View>
```

### Step 5: Add Scan Button Styles

```typescript
scanButton: {
  backgroundColor: '#34C759',
  paddingVertical: 18,
  paddingHorizontal: 30,
  borderRadius: 30,
  marginRight: 15,
},
scanButtonDisabled: {
  backgroundColor: '#888',
},
scanButtonText: {
  color: '#fff',
  fontSize: 18,
},
```

---

## 4. Code Snippets

### Complete Frame Capture Function

```typescript
import { CameraView } from 'expo-camera';

const captureAndAnalyze = async (cameraRef: React.RefObject<CameraView>) => {
  if (!cameraRef.current) {
    console.error('Camera ref not available');
    return null;
  }

  try {
    const photo = await cameraRef.current.takePictureAsync({
      base64: true,
      quality: 0.5, // Lower quality = faster upload
      skipProcessing: true, // Skip extra processing for speed
    });

    if (!photo?.base64) {
      console.error('No image data captured');
      return null;
    }

    console.log(`Captured image: ${photo.width}x${photo.height}`);
    return photo.base64;
  } catch (error) {
    console.error('Frame capture error:', error);
    return null;
  }
};
```

### Mock API Response (For Testing Without API Key)

```typescript
// Use this for testing UI before getting API key
const mockDetectionResponse = {
  success: true,
  objects: [
    { label: 'door', confidence: 0.95, position: 'center', distance: 'medium' },
    { label: 'wall', confidence: 0.88, position: 'left', distance: 'near' },
    { label: 'exit sign', confidence: 0.92, position: 'right', distance: 'far' },
    { label: 'trash can', confidence: 0.76, position: 'left', distance: 'near' },
  ],
  processingTime: 245,
};
```

### Environment Variable Access (React Native)

The API key is automatically loaded from `.env` using `react-native-dotenv`:

```typescript
// In OvershootService.ts
import { OVERSHOOT_API_KEY, OVERSHOOT_API_URL } from '@env';

// The service uses these automatically
const API_KEY = OVERSHOOT_API_KEY || '';
const API_URL = OVERSHOOT_API_URL || 'https://api.overshoot.ai/v1/detect';
```

**Important:** After adding or modifying `.env`:
1. Stop the Expo server
2. Run `npx expo start --clear` to clear the cache
3. Reload the app

If you see "Overshoot API key not configured" in console, ensure:
- Your `.env` file is in the ClearPath root directory (not in src/)
- The key is: `OVERSHOOT_API_KEY=your_key_here` (no quotes, no spaces)
- You restarted Metro bundler with `--clear` flag

---

## 5. Testing Checklist

### Pre-Testing Setup

- [ ] Overshoot API key obtained and configured
- [ ] Dependencies installed (`expo-file-system`)
- [ ] OvershootService.ts created
- [ ] HomeScreen.tsx updated with camera ref
- [ ] Scan button added to UI

### Test Scenarios

| Test ID | Scenario | Location | Expected Objects |
|---------|----------|----------|------------------|
| T1 | Hallway with signs | Corridor | Walls, doors, signs |
| T2 | Near washroom | Restroom area | Washroom sign, door |
| T3 | Lobby/open area | Building lobby | People, benches, trash |
| T4 | Stairwell | Near stairs | Stairs, handrails, signs |
| T5 | Elevator area | Elevator bank | Elevator doors, buttons |

### Test Procedure

1. Open app and navigate to camera view
2. Point camera at test scenario location
3. Tap "Scan" button
4. Check console for detection results
5. Verify detected objects match actual environment
6. Note any false positives or missed objects

### Success Criteria

- [ ] API responds within 2 seconds
- [ ] At least 3 objects detected per scan
- [ ] Confidence scores > 70% for primary objects
- [ ] Position estimation is reasonably accurate
- [ ] No app crashes during scanning

### Console Log Example (Expected Output)

```
Starting scan...
Frame captured, sending to Overshoot...
Sending image to Overshoot API...
Overshoot API Response: {
  "detections": [...],
  "processingTime": 342
}

=== OVERSHOOT DETECTION RESULTS ===
Processing time: 342ms
Objects detected: 4

1. DOOR
   Confidence: 95.2%
   Position: center
   Distance: medium

2. WALL
   Confidence: 88.1%
   Position: left
   Distance: near

3. EXIT SIGN
   Confidence: 91.7%
   Position: right
   Distance: far

4. TRASH CAN
   Confidence: 76.3%
   Position: left
   Distance: near

===================================
```

---

## 6. Troubleshooting

### Common Issues

#### "Camera ref is null"
- Ensure the `ref` prop is correctly attached to `ExpoCameraView`
- Check that camera permissions are granted
- Verify the camera screen is fully mounted before scanning

#### "API returned 401 Unauthorized"
- Check that your API key is correct
- Verify the API key is being sent in the Authorization header
- Ensure the API key hasn't expired

#### "No objects detected"
- Try improving lighting conditions
- Ensure the camera is pointed at recognizable objects
- Increase image quality in `takePictureAsync()`
- Check that the prompt matches Overshoot's expected format

#### "Slow response times (>3 seconds)"
- Reduce image quality to 0.3-0.5
- Check network connection
- Consider implementing image resizing before upload

#### "App crashes on scan"
- Check for memory issues with large images
- Ensure async/await is properly handled
- Add try-catch blocks around all async operations

### Debug Mode

Add this to OvershootService for debugging:

```typescript
const DEBUG = true;

if (DEBUG) {
  console.log('Request payload:', {
    imageSize: base64Image.length,
    apiUrl: this.apiUrl,
    hasApiKey: !!this.apiKey,
  });
}
```

---

## Next Steps After Testing

1. **If console output works correctly:**
   - Add visual bounding boxes on camera view
   - Implement voice announcement of detected objects
   - Add continuous scanning mode (every 2-3 seconds)

2. **If API integration has issues:**
   - Test with mock data first
   - Contact Overshoot support
   - Consider alternative APIs (Google Vision, AWS Rekognition)

3. **Optimization:**
   - Implement frame rate limiting
   - Add detection caching
   - Optimize image size for faster uploads

---

## Resources

- [Overshoot API Documentation](https://docs.overshoot.ai)
- [Expo Camera Documentation](https://docs.expo.dev/versions/latest/sdk/camera/)
- [React Native Image Handling](https://reactnative.dev/docs/images)

---

*Last Updated: January 2025*
*ClearPath Team - NexHacks 2025*
