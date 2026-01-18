/**
 * ClearPath - Indoor Navigation for Everyone
 * 
 * Web-only implementation using Overshoot SDK + ElevenLabs TTS + WisprFlow STT
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import OvershootService, { DetectionResponse } from '../services/OvershootService';
import ElevenLabsService from '../services/ElevenLabsTTS';
import WisprFlowService from '../services/WisprFlow';

// Throttle config
const SPEECH_INTERVAL_MS = 4000; // 2 seconds between announcements

// Video element for displaying camera stream
const VideoPreview = ({ mediaStream }: { mediaStream: MediaStream | null }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(console.error);
    }
  }, [mediaStream]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.videoContainer}>
        <Text style={styles.errorText}>Web browser required</Text>
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </View>
  );
};

// Landing Page Component
const LandingPage = ({ onStart }: { onStart: () => void }) => {
  return (
    <View style={styles.landingContainer}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>🧭</Text>
        <Text style={styles.title}>ClearPath</Text>
        <Text style={styles.tagline}>Indoor Navigation</Text>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={onStart}>
        <Text style={styles.startButtonText}>Start</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>NexHacks 2025</Text>
    </View>
  );
};

// Camera/Detection Screen Component
const CameraScreen = ({ onBack }: { onBack: () => void }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  
  // Voice command state
  const [isListening, setIsListening] = useState(false);
  const [userCommand, setUserCommand] = useState<string | null>(null);
  
  // Throttle tracking
  const lastSpokenTimeRef = useRef<number>(0);
  const lastSpokenTextRef = useRef<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) {
        OvershootService.stopStreaming();
      }
      ElevenLabsService.stop();
      WisprFlowService.cancelRecording();
    };
  }, [isStreaming]);

  // Start streaming with welcome message
  const handleStart = async () => {
    if (!OvershootService.hasApiKey()) {
      setError('Overshoot API key not configured');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    // Welcome message - wait for it to finish
    await ElevenLabsService.speak("Welcome to ClearPath. Starting navigation. Hold your phone at chest level with camera facing forward. Tap the microphone to ask for directions.");

    // Small delay to ensure welcome finishes
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[CameraScreen] Starting Overshoot...');

    const started = await OvershootService.startStreaming((result) => {
      console.log('[CameraScreen] Result:', result);
      setResults(result);

      if (!result.success && result.error) {
        setError(result.error);
        return;
      }

      setError(null);

      // Auto-speak with throttling
      if (autoSpeak && result.rawResult) {
        const now = Date.now();
        const timeSinceLast = now - lastSpokenTimeRef.current;
        const isDifferentText = result.rawResult !== lastSpokenTextRef.current;

        // Only speak if: enough time passed AND text is different AND not currently speaking
        if (timeSinceLast >= SPEECH_INTERVAL_MS && isDifferentText && !ElevenLabsService.isCurrentlySpeaking()) {
          lastSpokenTimeRef.current = now;
          lastSpokenTextRef.current = result.rawResult;
          ElevenLabsService.speak(result.rawResult);
        }
      }
    });

    if (started) {
      setIsStreaming(true);
      const stream = OvershootService.getMediaStream();
      setMediaStream(stream);
    } else {
      setError('Failed to start camera');
    }

    setIsLoading(false);
  };

  // Stop streaming
  const handleStop = async () => {
    await OvershootService.stopStreaming();
    ElevenLabsService.stop();
    
    // Goodbye message
    await ElevenLabsService.speak("Navigation stopped.");
    
    setIsStreaming(false);
    setMediaStream(null);
  };

  // Manual speak button
  const handleSpeak = () => {
    if (!results?.rawResult) return;
    ElevenLabsService.speak(results.rawResult);
  };

  // Handle back with cleanup
  const handleBack = () => {
    if (isStreaming) {
      OvershootService.stopStreaming();
      ElevenLabsService.stop();
    }
    WisprFlowService.cancelRecording();
    onBack();
  };

  // Handle voice command recording
  const handleMicPress = async () => {
    if (isListening) {
      // Stop recording and process command
      setIsListening(false);
      const command = await WisprFlowService.stopRecordingAndTranscribe();
      
      if (command) {
        setUserCommand(command);
        await processVoiceCommand(command);
      }
    } else {
      // Start recording
      const started = await WisprFlowService.startRecording();
      if (started) {
        setIsListening(true);
        // Provide audio feedback
        await ElevenLabsService.speak("Listening...");
        
        // Auto-stop after 5 seconds if user forgets
        setTimeout(async () => {
          if (WisprFlowService.isCurrentlyRecording()) {
            setIsListening(false);
            const command = await WisprFlowService.stopRecordingAndTranscribe();
            if (command) {
              setUserCommand(command);
              await processVoiceCommand(command);
            }
          }
        }, 5000);
      } else {
        setError('Could not access microphone');
      }
    }
  };

  // Process voice command and update navigation
  const processVoiceCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    let response = '';
    let newPrompt = '';
    
    // Understand user intent
    if (lowerCommand.includes('exit') || lowerCommand.includes('leave') || lowerCommand.includes('way out')) {
      response = "Looking for the exit. I'll guide you there.";
      newPrompt = `Guide the user to find an exit. Look for exit signs, doors leading outside, or emergency exits. Give clear directions like "Exit sign ahead on your right" or "Door to outside on your left".`;
    } else if (lowerCommand.includes('bathroom') || lowerCommand.includes('restroom') || lowerCommand.includes('toilet') || lowerCommand.includes('washroom')) {
      response = "Looking for the restroom. I'll help you find it.";
      newPrompt = `Guide the user to find a bathroom or restroom. Look for restroom signs, bathroom doors, or indicators. Give clear directions.`;
    } else if (lowerCommand.includes('elevator') || lowerCommand.includes('lift')) {
      response = "Looking for an elevator.";
      newPrompt = `Guide the user to find an elevator. Look for elevator doors, buttons, or signs. Give clear directions.`;
    } else if (lowerCommand.includes('stairs') || lowerCommand.includes('stairway') || lowerCommand.includes('staircase')) {
      response = "Looking for stairs.";
      newPrompt = `Guide the user to find stairs or a stairwell. Look for stairwell doors, stair signs, or actual stairs. Give clear directions.`;
    } else if (lowerCommand.includes('door') || lowerCommand.includes('entrance')) {
      response = "Looking for a door.";
      newPrompt = `Guide the user to find the nearest door. Look for doors, entrances, or doorways. Give clear directions with distance estimates.`;
    } else if (lowerCommand.includes('help') || lowerCommand.includes('what can')) {
      response = "You can ask me to find the exit, bathroom, elevator, stairs, or any specific location. Just tap the microphone and speak your request.";
      newPrompt = ''; // Don't change the prompt
    } else if (lowerCommand.includes('stop') || lowerCommand.includes('cancel') || lowerCommand.includes('nevermind')) {
      response = "Okay, continuing with general navigation.";
      newPrompt = `You are a navigation assistant for a visually impaired person. Give brief, clear directions in 1-2 sentences max. Focus on obstacles, doors, turns, and distance estimates.`;
    } else {
      response = "Looking for " + command + " now.";
      newPrompt = `The user is looking for: ${command}. Help guide them to find it. Look for signs, doors, or any indication of ${command}. Give clear navigation directions.`;
    }
    
    // Speak the response
    await ElevenLabsService.speak(response);
    
    // Update Overshoot prompt if needed
    if (newPrompt && isStreaming) {
      try {
        await OvershootService.updatePrompt(newPrompt);
        console.log('[CameraScreen] Prompt updated for:', command);
      } catch (err) {
        console.error('[CameraScreen] Failed to update prompt:', err);
      }
    }
  };

  return (
    <View style={styles.cameraContainer}>
      {/* Camera Preview - Full Screen */}
      {isStreaming && mediaStream ? (
        <VideoPreview mediaStream={mediaStream} />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderIcon}>📷</Text>
          <Text style={styles.placeholderText}>
            {isLoading ? 'Starting...' : 'Tap Start to begin'}
          </Text>
        </View>
      )}

      {/* Minimal Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerRight}>
          {/* Auto-speak toggle */}
          <TouchableOpacity 
            style={[styles.autoSpeakToggle, autoSpeak && styles.autoSpeakActive]}
            onPress={() => setAutoSpeak(!autoSpeak)}
          >
            <Text style={styles.autoSpeakIcon}>{autoSpeak ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
          
          <View style={[styles.statusDot, isStreaming && styles.statusDotActive]} />
        </View>
      </View>

      {/* User Command Display */}
      {userCommand && (
        <View style={styles.commandBanner}>
          <Text style={styles.commandText}>🎤 "{userCommand}"</Text>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results Overlay - Shows AI description */}
      {results?.rawResult && (
        <View style={styles.resultsOverlay}>
          <Text style={styles.resultsText}>{results.rawResult}</Text>
        </View>
      )}

      {/* Listening Indicator */}
      {isListening && (
        <View style={styles.listeningOverlay}>
          <Text style={styles.listeningIcon}>🎤</Text>
          <Text style={styles.listeningText}>Listening...</Text>
          <Text style={styles.listeningHint}>Tap again to stop</Text>
        </View>
      )}

      {/* Bottom Controls */}
      <View style={styles.controls}>
        {/* Manual Speak Button */}
        <TouchableOpacity
          style={[styles.speakButton, !results?.rawResult && styles.buttonDisabled]}
          onPress={handleSpeak}
          disabled={!results?.rawResult}
        >
          <Text style={styles.speakIcon}>🔊</Text>
        </TouchableOpacity>

        {/* Main Action Button */}
        <TouchableOpacity
          style={[
            styles.mainButton,
            isStreaming && styles.stopButton,
            isLoading && styles.loadingButton
          ]}
          onPress={isStreaming ? handleStop : handleStart}
          disabled={isLoading}
        >
          <Text style={[styles.mainButtonText, isStreaming && styles.stopButtonText]}>
            {isLoading ? '...' : isStreaming ? 'Stop' : 'Start'}
          </Text>
        </TouchableOpacity>

        {/* Mic Button for Voice Commands */}
        <TouchableOpacity
          style={[styles.micButton, isListening && styles.micButtonActive]}
          onPress={handleMicPress}
        >
          <Text style={styles.micIcon}>{isListening ? '⏹️' : '🎤'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main HomeScreen Component
export const HomeScreen = () => {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return <CameraScreen onBack={() => setShowCamera(false)} />;
  }

  return <LandingPage onStart={() => setShowCamera(true)} />;
};

const styles = StyleSheet.create({
  // Landing Page
  landingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  logoIcon: {
    fontSize: 72,
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    color: '#fff',
    fontWeight: '200',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    letterSpacing: 2,
  },
  startButton: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 80,
    borderRadius: 50,
  },
  startButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    color: '#333',
    fontSize: 12,
    letterSpacing: 1,
  },

  // Camera Screen
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  placeholderText: {
    color: '#444',
    fontSize: 18,
    letterSpacing: 1,
  },

  // Header
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: '#fff',
    fontSize: 24,
  },
  autoSpeakToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoSpeakActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.7)',
  },
  autoSpeakIcon: {
    fontSize: 18,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  statusDotActive: {
    backgroundColor: '#ff3b30',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  // Command Banner
  commandBanner: {
    position: 'absolute',
    top: 120,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 10,
  },
  commandText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Error Banner
  errorBanner: {
    position: 'absolute',
    top: 120,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },

  // Results Overlay
  resultsOverlay: {
    position: 'absolute',
    bottom: 160,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    padding: 20,
    zIndex: 10,
  },
  resultsText: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },

  // Listening Overlay
  listeningOverlay: {
    position: 'absolute',
    top: '40%',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    zIndex: 20,
  },
  listeningIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  listeningText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  listeningHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },

  // Bottom Controls
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  mainButton: {
    backgroundColor: '#fff',
    width: 140,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#ff3b30',
  },
  loadingButton: {
    backgroundColor: '#666',
  },
  mainButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 1,
  },
  stopButtonText: {
    color: '#fff',
  },
  speakButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  speakIcon: {
    fontSize: 24,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  micIcon: {
    fontSize: 24,
  },
});

export default HomeScreen;