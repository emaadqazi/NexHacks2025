/**
 * ClearPath - Indoor Navigation for Everyone
 * 
 * Web-only implementation using Overshoot SDK
 * Clean, minimal UI optimized for iPhone
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import OvershootService, { DetectionResponse } from '../services/OvershootService';

// Video element for displaying camera stream
const VideoPreview: React.FC<{ mediaStream: MediaStream | null }> = ({ mediaStream }) => {
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
const LandingPage: React.FC<{ onStart: () => void }> = ({ onStart }) => {
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

// Camera/Detection Screen Component - Clean Minimal Design
const CameraScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) {
        OvershootService.stopStreaming();
      }
    };
  }, [isStreaming]);

  // Start streaming
  const handleStart = async () => {
    if (!OvershootService.hasApiKey()) {
      setError('API key not configured');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    console.log('[CameraScreen] Starting Overshoot...');

    const started = await OvershootService.startStreaming((result) => {
      console.log('[CameraScreen] Result:', result);
      setResults(result);

      if (!result.success && result.error) {
        setError(result.error);
      } else {
        setError(null);
      }
    });

    if (started) {
      setIsStreaming(true);
      const stream = OvershootService.getMediaStream();
      setMediaStream(stream);
    }

    setIsLoading(false);
  };

  // Stop streaming
  const handleStop = async () => {
    await OvershootService.stopStreaming();
    setIsStreaming(false);
    setMediaStream(null);
  };

  // Speak results
  const handleSpeak = () => {
    if (!results?.rawResult) return;

    const text = results.rawResult;
    console.log('[Voice]', text);

    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
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
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        
        <View style={[styles.statusDot, isStreaming && styles.statusDotActive]} />
      </View>

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

      {/* Bottom Controls */}
      <View style={styles.controls}>
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
          <Text style={styles.mainButtonText}>
            {isLoading ? '...' : isStreaming ? 'Stop' : 'Start'}
          </Text>
        </TouchableOpacity>

        {/* Speak Button */}
        <TouchableOpacity
          style={[styles.speakButton, !results?.rawResult && styles.buttonDisabled]}
          onPress={handleSpeak}
          disabled={!results?.rawResult}
        >
          <Text style={styles.speakIcon}>🔊</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main HomeScreen Component
export const HomeScreen: React.FC = () => {
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

  // Minimal Header
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
    width: 160,
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
});

export default HomeScreen;
