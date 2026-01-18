/**
 * ClearPath - Indoor Navigation for Everyone
 * 
 * Web-only implementation using Overshoot SDK + ElevenLabs TTS + WisprFlow STT
 * Optimized for iOS Safari via HTTPS tunnel
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform, ScrollView } from 'react-native';
import OvershootService, { DetectionResponse } from '../services/OvershootService';
import ElevenLabsService from '../services/ElevenLabsTTS';
import WisprFlowService from '../services/WisprFlow';

// Throttle config
const SPEECH_INTERVAL_MS = 4000; // 4 seconds between announcements

// ============= DIAGNOSTICS PANEL =============
interface DiagnosticsInfo {
  url: string;
  isHttps: boolean;
  hasGetUserMedia: boolean;
  hasMediaRecorder: boolean;
  supportedMimeTypes: string[];
  hasSpeechRecognition: boolean;
  hasSpeechSynthesis: boolean;
  lastError: string | null;
  overshootKey: boolean;
  elevenLabsKey: boolean;
  wisprKey: boolean;
}

const getDiagnostics = (): DiagnosticsInfo => {
  const info: DiagnosticsInfo = {
    url: '',
    isHttps: false,
    hasGetUserMedia: false,
    hasMediaRecorder: false,
    supportedMimeTypes: [],
    hasSpeechRecognition: false,
    hasSpeechSynthesis: false,
    lastError: null,
    overshootKey: false,
    elevenLabsKey: false,
    wisprKey: false,
  };

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    info.url = window.location.href;
    info.isHttps = window.location.protocol === 'https:';
    info.hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
    info.hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    
    // Check supported mime types
    if (info.hasMediaRecorder) {
      const mimeTypes = [
        'audio/mp4',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      info.supportedMimeTypes = mimeTypes.filter(type => {
        try {
          return MediaRecorder.isTypeSupported(type);
        } catch {
          return false;
        }
      });
    }
    
    // Check for Speech Recognition - more robust check for iOS Safari
    // On iOS, webkitSpeechRecognition might not always be directly accessible
    // Try multiple methods to detect it
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        // Try to instantiate it to verify it actually works
        // Don't actually instantiate in diagnostic mode, just check if constructor exists
        info.hasSpeechRecognition = typeof SpeechRecognition === 'function';
      } else {
        // Also check in webkit namespace (some iOS versions)
        info.hasSpeechRecognition = !!(window as any).webkit?.SpeechRecognition;
      }
    } catch {
      // If check fails, assume not available
      info.hasSpeechRecognition = false;
    }
    
    // Fallback: Use WisprFlowService's method if direct check fails
    if (!info.hasSpeechRecognition && WisprFlowService.isSpeechRecognitionAvailable()) {
      info.hasSpeechRecognition = true;
    }
    
    info.hasSpeechSynthesis = 'speechSynthesis' in window;
  }

  // Check API keys
  info.overshootKey = OvershootService.hasApiKey();
  info.elevenLabsKey = ElevenLabsService.hasApiKey();
  info.wisprKey = WisprFlowService.hasApiKey();

  return info;
};

const DiagnosticsPanel = ({ 
  visible, 
  onClose, 
  lastError 
}: { 
  visible: boolean; 
  onClose: () => void;
  lastError: string | null;
}) => {
  const [info, setInfo] = useState<DiagnosticsInfo | null>(null);

  useEffect(() => {
    if (visible) {
      const diagnostics = getDiagnostics();
      diagnostics.lastError = lastError;
      setInfo(diagnostics);
    }
  }, [visible, lastError]);

  if (!visible || !info) return null;

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <View style={[styles.diagBadge, ok ? styles.diagBadgeOk : styles.diagBadgeFail]}>
      <Text style={styles.diagBadgeText}>{ok ? '✓' : '✗'} {label}</Text>
    </View>
  );

  return (
    <View style={styles.diagOverlay}>
      <View style={styles.diagPanel}>
        <View style={styles.diagHeader}>
          <Text style={styles.diagTitle}>📊 Diagnostics</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.diagClose}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.diagContent}>
          <Text style={styles.diagSection}>Connection</Text>
          <Text style={styles.diagUrl} numberOfLines={2}>{info.url}</Text>
          <View style={styles.diagRow}>
            <StatusBadge ok={info.isHttps} label="HTTPS" />
          </View>

          <Text style={styles.diagSection}>Browser APIs</Text>
          <View style={styles.diagRow}>
            <StatusBadge ok={info.hasGetUserMedia} label="Camera" />
            <StatusBadge ok={info.hasMediaRecorder} label="MediaRecorder" />
          </View>
          <View style={styles.diagRow}>
            <StatusBadge ok={info.hasSpeechRecognition} label="SpeechRecognition" />
            <StatusBadge ok={info.hasSpeechSynthesis} label="SpeechSynthesis" />
          </View>

          {info.supportedMimeTypes.length > 0 && (
            <>
              <Text style={styles.diagSection}>Supported Audio Formats</Text>
              <Text style={styles.diagMime}>{info.supportedMimeTypes.join(', ') || 'None'}</Text>
            </>
          )}

          <Text style={styles.diagSection}>API Keys</Text>
          <View style={styles.diagRow}>
            <StatusBadge ok={info.overshootKey} label="Overshoot" />
            <StatusBadge ok={info.elevenLabsKey} label="ElevenLabs" />
            <StatusBadge ok={info.wisprKey} label="Wispr" />
          </View>

          {info.lastError && (
            <>
              <Text style={styles.diagSection}>Last Error</Text>
              <Text style={styles.diagError}>{info.lastError}</Text>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

// ============= VIDEO PREVIEW =============
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

// ============= LANDING PAGE =============
const LandingPage = ({ onStart }: { onStart: () => void }) => {
  const [showDiag, setShowDiag] = useState(false);

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

      {/* Diagnostics button */}
      <TouchableOpacity 
        style={styles.diagButton} 
        onPress={() => setShowDiag(true)}
      >
        <Text style={styles.diagButtonText}>📊 Diagnostics</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>NexHacks 2025</Text>

      <DiagnosticsPanel 
        visible={showDiag} 
        onClose={() => setShowDiag(false)}
        lastError={null}
      />
    </View>
  );
};

// ============= CAMERA SCREEN =============
const CameraScreen = ({ onBack }: { onBack: () => void }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showDiag, setShowDiag] = useState(false);
  
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

  // ===== FIXED: Start streaming IMMEDIATELY on user gesture =====
  const handleStart = async () => {
    if (!OvershootService.hasApiKey()) {
      setError('Overshoot API key not configured');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    // 1. Unlock audio on user gesture FIRST (synchronous)
    ElevenLabsService.unlockAudio();

    // 2. Start camera/WebRTC IMMEDIATELY (this is the critical user-gesture call)
    console.log('[CameraScreen] Starting Overshoot IMMEDIATELY on user gesture...');
    
    const streamingPromise = OvershootService.startStreaming((result) => {
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

        if (timeSinceLast >= SPEECH_INTERVAL_MS && isDifferentText && !ElevenLabsService.isCurrentlySpeaking()) {
          lastSpokenTimeRef.current = now;
          lastSpokenTextRef.current = result.rawResult;
          ElevenLabsService.speak(result.rawResult);
        }
      }
    });

    // 3. Welcome message runs in parallel (non-blocking)
    ElevenLabsService.speak("Welcome to ClearPath. Starting navigation.");

    // 4. Wait for stream to actually start
    const started = await streamingPromise;

    if (started) {
      setIsStreaming(true);
      const stream = OvershootService.getMediaStream();
      setMediaStream(stream);
    } else {
      setError('Failed to start camera. Check permissions.');
    }

    setIsLoading(false);
  };

  // Stop streaming
  const handleStop = async () => {
    await OvershootService.stopStreaming();
    ElevenLabsService.stop();
    
    // Goodbye message (non-blocking)
    ElevenLabsService.speak("Navigation stopped.");
    
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
    // Unlock audio on gesture
    ElevenLabsService.unlockAudio();
    
    if (isListening) {
      // Stop recording and process command
      setIsListening(false);
      const command = await WisprFlowService.stopRecordingAndTranscribe();
      
      if (command) {
        setUserCommand(command);
        await processVoiceCommand(command);
      }
    } else {
      // Start recording IMMEDIATELY on user gesture
      const started = await WisprFlowService.startRecording();
      if (started) {
        setIsListening(true);
        // Audio feedback (non-blocking)
        ElevenLabsService.speak("Listening...");
        
        // Auto-stop after 5 seconds
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
        const fallbackResult = await WisprFlowService.useFallbackInput();
        if (fallbackResult) {
          setUserCommand(fallbackResult);
          await processVoiceCommand(fallbackResult);
        } else {
          setError('Voice input not available on this device');
        }
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
      response = "Looking for the exit.";
      newPrompt = `Guide the user to find an exit. Look for exit signs, doors leading outside, or emergency exits. Give clear directions.`;
    } else if (lowerCommand.includes('bathroom') || lowerCommand.includes('restroom') || lowerCommand.includes('toilet') || lowerCommand.includes('washroom')) {
      response = "Looking for the restroom.";
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
      response = "You can ask me to find the exit, bathroom, elevator, stairs, or any specific location.";
      newPrompt = '';
    } else if (lowerCommand.includes('stop') || lowerCommand.includes('cancel') || lowerCommand.includes('nevermind')) {
      response = "Continuing with general navigation.";
      newPrompt = `You are a navigation assistant for a visually impaired person. Give brief, clear directions in 1-2 sentences max. Focus on obstacles, doors, turns, and distance estimates.`;
    } else {
      response = "Looking for " + command + " now.";
      newPrompt = `The user is looking for: ${command}. Help guide them to find it. Look for signs, doors, or any indication of ${command}. Give clear navigation directions.`;
    }
    
    // Speak the response
    ElevenLabsService.speak(response);
    
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
            {isLoading ? 'Starting camera...' : 'Tap Start to begin'}
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerRight}>
          {/* Diagnostics button */}
          <TouchableOpacity 
            style={styles.headerDiagButton}
            onPress={() => setShowDiag(true)}
          >
            <Text style={styles.headerDiagIcon}>📊</Text>
          </TouchableOpacity>
          
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

      {/* Results Overlay */}
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

      {/* Diagnostics Panel */}
      <DiagnosticsPanel 
        visible={showDiag} 
        onClose={() => setShowDiag(false)}
        lastError={error}
      />
    </View>
  );
};

// ============= MAIN COMPONENT =============
export const HomeScreen = () => {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return <CameraScreen onBack={() => setShowCamera(false)} />;
  }

  return <LandingPage onStart={() => setShowCamera(true)} />;
};

// ============= STYLES =============
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
  diagButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  diagButtonText: {
    color: '#666',
    fontSize: 14,
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
  headerDiagButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDiagIcon: {
    fontSize: 16,
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

  // Diagnostics Panel
  diagOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  diagPanel: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  diagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  diagTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  diagClose: {
    color: '#888',
    fontSize: 24,
    padding: 4,
  },
  diagContent: {
    padding: 16,
  },
  diagSection: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  diagUrl: {
    color: '#4a9eff',
    fontSize: 12,
    marginBottom: 8,
  },
  diagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  diagBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  diagBadgeOk: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  diagBadgeFail: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  diagBadgeText: {
    color: '#fff',
    fontSize: 12,
  },
  diagMime: {
    color: '#666',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  diagError: {
    color: '#ff6b6b',
    fontSize: 12,
    backgroundColor: 'rgba(255,59,48,0.1)',
    padding: 8,
    borderRadius: 8,
  },
});

export default HomeScreen;
