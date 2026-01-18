/**
 * ClearPath - Indoor Navigation for Everyone
 * 
 * Web-only implementation using Overshoot SDK
 * Access via HTTPS tunnel from iPhone Safari
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import OvershootService, { DetectionResponse } from '../services/OvershootService';

// Video element ref for displaying camera stream
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
        <Text style={styles.tagline}>Indoor Navigation for Everyone</Text>
      </View>

      <View style={styles.featuresContainer}>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📷</Text>
          <Text style={styles.featureText}>Real-time Object Detection</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🎤</Text>
          <Text style={styles.featureText}>Voice Announcements</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🗺️</Text>
          <Text style={styles.featureText}>Indoor Navigation</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={onStart}>
        <Text style={styles.startButtonText}>Start Navigation</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>NexHacks 2025</Text>
    </View>
  );
};

// Camera/Detection Screen Component
const CameraScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isCameraTestMode, setIsCameraTestMode] = useState(false);
  const [cameraTestStream, setCameraTestStream] = useState<MediaStream | null>(null);
  const [resultCount, setResultCount] = useState(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) {
        OvershootService.stopStreaming();
      }
      // Clean up camera test stream
      if (cameraTestStream) {
        cameraTestStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isStreaming, cameraTestStream]);

  // Test camera directly without Overshoot SDK
  const handleTestCamera = async () => {
    if (isCameraTestMode && cameraTestStream) {
      // Stop the test
      cameraTestStream.getTracks().forEach(track => track.stop());
      setCameraTestStream(null);
      setIsCameraTestMode(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log('[CameraScreen] Testing camera with getUserMedia...');

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser. Make sure you are using HTTPS.');
      }

      // Try to get camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      console.log('[CameraScreen] Camera test SUCCESS! Stream tracks:', stream.getTracks().map(t => ({
        kind: t.kind,
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState,
      })));

      setCameraTestStream(stream);
      setIsCameraTestMode(true);
      setError(null);
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || 'Unknown camera error';
      console.error('[CameraScreen] Camera test FAILED:', errMsg);
      console.error('[CameraScreen] Error name:', err?.name);
      console.error('[CameraScreen] Full error:', err);
      
      let userFriendlyMsg = `Camera Error: ${errMsg}`;
      if (err?.name === 'NotAllowedError') {
        userFriendlyMsg = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err?.name === 'NotFoundError') {
        userFriendlyMsg = 'No camera found. Make sure your device has a camera.';
      } else if (err?.name === 'NotReadableError') {
        userFriendlyMsg = 'Camera is in use by another application.';
      } else if (err?.name === 'OverconstrainedError') {
        userFriendlyMsg = 'Camera constraints could not be satisfied.';
      } else if (err?.name === 'SecurityError') {
        userFriendlyMsg = 'Camera access blocked. HTTPS is required for camera access.';
      }
      
      setError(userFriendlyMsg);
    }
    setIsLoading(false);
  };

  // Start streaming
  const handleStart = async () => {
    // Auto-stop camera test if active
    if (isCameraTestMode && cameraTestStream) {
      console.log('[CameraScreen] Auto-stopping camera test before starting AI...');
      cameraTestStream.getTracks().forEach(track => track.stop());
      setCameraTestStream(null);
      setIsCameraTestMode(false);
    }

    if (!OvershootService.hasApiKey()) {
      setError('API key not configured. Set EXPO_PUBLIC_OVERSHOOT_API_KEY in your environment.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setResultCount(0);

    console.log('[CameraScreen] ====== STARTING OVERSHOOT ======');
    console.log('[CameraScreen] API Key available:', OvershootService.hasApiKey());

    const started = await OvershootService.startStreaming((result) => {
      // Increment result counter
      setResultCount(prev => {
        const newCount = prev + 1;
        console.log(`[CameraScreen] ===== RECEIVED RESULT #${newCount} =====`);
        return newCount;
      });
      
      console.log('[CameraScreen] Result success:', result.success);
      console.log('[CameraScreen] Result error:', result.error);
      console.log('[CameraScreen] Raw result:', result.rawResult);
      console.log('[CameraScreen] Objects count:', result.objects?.length || 0);
      console.log('[CameraScreen] Processing time:', result.processingTime, 'ms');
      
      setResults(result);

      // Log formatted results
      console.log(OvershootService.formatResultsForLog(result));

      if (!result.success && result.error) {
        setError(result.error);
      } else {
        setError(null); // Clear any previous error on success
      }
    });

    console.log('[CameraScreen] startStreaming returned:', started);

    if (started) {
      setIsStreaming(true);
      console.log('[CameraScreen] ✅ Stream started, getting media stream...');
      // Get the media stream for video preview
      const stream = OvershootService.getMediaStream();
      console.log('[CameraScreen] Media stream:', stream ? 'Available' : 'NULL');
      setMediaStream(stream);
    } else {
      console.log('[CameraScreen] ❌ Stream failed to start');
    }

    setIsLoading(false);
  };

  // Stop streaming
  const handleStop = async () => {
    console.log('[CameraScreen] Stopping stream...');
    await OvershootService.stopStreaming();
    setIsStreaming(false);
    setMediaStream(null);
    console.log('[CameraScreen] Stream stopped. Total results received:', resultCount);
  };

  // Speak results
  const handleSpeak = () => {
    if (!results) {
      alert('No detection results yet. Start streaming first.');
      return;
    }

    const text = OvershootService.formatResultsForVoice(results);
    console.log('[Voice]', text);

    // Use browser speech synthesis
    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      alert(text);
    }
  };

  return (
    <View style={styles.cameraContainer}>
      {/* Video Preview */}
      {(isStreaming && mediaStream) || (isCameraTestMode && cameraTestStream) ? (
        <VideoPreview mediaStream={isStreaming ? mediaStream : cameraTestStream} />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderText}>
            {isLoading ? 'Starting camera...' : 'Camera Preview'}
          </Text>
        </View>
      )}

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.titleBar}>ClearPath</Text>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, isStreaming && styles.statusDotActive]} />
          <Text style={styles.statusText}>{isStreaming ? 'Live' : 'Off'}</Text>
        </View>
      </View>

      {/* Debug Info - API Key Status */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>
          Key: {OvershootService.hasApiKey() ? '✅' : '❌'}
        </Text>
        <Text style={styles.debugText}>
          Stream: {isStreaming ? '🟢 Live' : '⚫ Off'}
        </Text>
        <Text style={styles.debugText}>
          Results: {resultCount}
        </Text>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results Display */}
      {results && results.success && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Detection Results</Text>
          {results.rawResult ? (
            <ScrollView style={styles.resultsList}>
              <Text style={styles.rawResultText}>{results.rawResult}</Text>
            </ScrollView>
          ) : results.objects.length > 0 ? (
            <ScrollView style={styles.resultsList}>
              {results.objects.map((obj, index) => (
                <View key={index} style={styles.resultItem}>
                  <Text style={styles.resultLabel}>{obj.label}</Text>
                  <Text style={styles.resultDetails}>
                    {obj.position} • {obj.distance}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noResultsText}>No objects detected</Text>
          )}
          <Text style={styles.latencyText}>Latency: {results.processingTime}ms</Text>
        </View>
      )}

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Test Camera Button - Tests getUserMedia directly */}
        <TouchableOpacity
          style={[styles.controlButton, isCameraTestMode && styles.testActiveButton]}
          onPress={handleTestCamera}
          disabled={isLoading || isStreaming}
        >
          <Text style={styles.controlButtonText}>
            {isCameraTestMode ? '🎥 Stop Test' : '🔧 Test Camera'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isStreaming && styles.stopButton]}
          onPress={isStreaming ? handleStop : handleStart}
          disabled={isLoading}
        >
          <Text style={styles.controlButtonText}>
            {isLoading ? 'Starting...' : isStreaming ? 'Stop' : 'Start AI'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.speakButton]}
          onPress={handleSpeak}
          disabled={!results}
        >
          <Text style={styles.controlButtonText}>🔊</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      {!isStreaming && !isLoading && !isCameraTestMode && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            1. First tap "Test Camera" to verify camera access works
          </Text>
          <Text style={styles.instructionsSubtext}>
            2. Then tap "Start AI" for Overshoot detection
          </Text>
        </View>
      )}

      {/* Camera Test Mode Info */}
      {isCameraTestMode && (
        <View style={styles.instructionsContainer}>
          <Text style={[styles.instructionsText, { color: '#34c759' }]}>
            ✅ Camera access working!
          </Text>
          <Text style={styles.instructionsSubtext}>
            Stop test, then tap "Start AI" to use Overshoot
          </Text>
        </View>
      )}
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
    backgroundColor: '#0a0a1a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoIcon: {
    fontSize: 80,
    marginBottom: 15,
  },
  title: {
    fontSize: 48,
    color: '#fff',
    fontWeight: '300',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    marginTop: 10,
    letterSpacing: 1,
  },
  featuresContainer: {
    marginBottom: 50,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  featureText: {
    color: '#ccc',
    fontSize: 16,
  },
  startButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 30,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    color: '#444',
    fontSize: 14,
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
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 18,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  titleBar: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#ff3b30',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
  },
  debugContainer: {
    position: 'absolute',
    top: 70,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
    zIndex: 5,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  debugText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  errorContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    padding: 15,
    borderRadius: 10,
    zIndex: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  resultsContainer: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 15,
    padding: 15,
    maxHeight: 250,
    zIndex: 10,
  },
  resultsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  resultsList: {
    maxHeight: 150,
  },
  resultItem: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  resultLabel: {
    color: '#4A90D9',
    fontSize: 16,
    fontWeight: '500',
  },
  resultDetails: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  rawResultText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  noResultsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  latencyText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 10,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  controlButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    minWidth: 120,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#ff3b30',
  },
  testActiveButton: {
    backgroundColor: '#34c759',
  },
  speakButton: {
    backgroundColor: '#34C759',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  instructionsContainer: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 5,
  },
  instructionsText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  instructionsSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default HomeScreen;
