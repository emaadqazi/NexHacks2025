/**
 * ClearPath Home Screen
 * 
 * Uses expo-camera for frame capture + WebSocket streaming to Overshoot
 * Compatible with Expo Go!
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import OvershootService, { DetectionResult } from '../services/OvershootService';

// Landing Page
const LandingPage: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDebugLogs(OvershootService.getDebugLogs());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const hasApiKey = OvershootService.hasApiKey();

  return (
    <View style={styles.landingContainer}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>🧭</Text>
        <Text style={styles.title}>ClearPath</Text>
        <Text style={styles.tagline}>Indoor Navigation</Text>
      </View>

      {/* Status Panel */}
      <View style={styles.statusPanel}>
        <Text style={styles.statusTitle}>System Status</Text>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Platform:</Text>
          <Text style={styles.statusValue}>{Platform.OS} 📱</Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>API Key:</Text>
          <Text style={[styles.statusValue, hasApiKey && styles.statusGood]}>
            {hasApiKey ? '✅ Loaded' : '❌ Missing'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Mode:</Text>
          <Text style={styles.statusValue}>
            WebSocket + Camera
          </Text>
        </View>

        {!hasApiKey && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ API Key Missing</Text>
            <Text style={styles.warningText}>
              Add EXPO_PUBLIC_OVERSHOOT_API_KEY to .env
            </Text>
          </View>
        )}
      </View>

      {/* Debug Logs */}
      <View style={styles.debugPanel}>
        <Text style={styles.debugTitle}>Debug Logs</Text>
        <ScrollView style={styles.debugLogs}>
          {debugLogs.slice(-12).map((log, i) => (
            <Text key={i} style={styles.debugLogText}>{log}</Text>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity 
        style={[styles.startButton, !hasApiKey && styles.startButtonDisabled]} 
        onPress={onStart}
        disabled={!hasApiKey}
      >
        <Text style={styles.startButtonText}>Start Camera</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>NexHacks 2025</Text>
    </View>
  );
};

// Camera Screen with WebSocket streaming
const CameraScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [framesSent, setFramesSent] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update logs
  useEffect(() => {
    const interval = setInterval(() => {
      setDebugLogs(OvershootService.getDebugLogs());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  // Capture and send frames
  const captureAndSendFrame = async () => {
    if (!cameraRef.current || !isStreaming) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });

      if (photo?.base64) {
        OvershootService.sendFrame(photo.base64);
        setFramesSent(prev => prev + 1);
      }
    } catch (e: any) {
      console.log('Frame capture error:', e.message);
    }
  };

  // Start streaming
  const startStreaming = async () => {
    setIsConnecting(true);
    setError(null);

    const connected = await OvershootService.startStreaming(
      (res) => {
        setResult(res);
        if (!res.success && res.error) {
          setError(res.error);
        } else {
          setError(null);
        }
      },
      'Describe what you see for navigation. Identify obstacles, doors, signs, stairs, and clear paths.'
    );

    setIsConnecting(false);

    if (connected) {
      setIsStreaming(true);
      setFramesSent(0);
      
      // Start sending frames every 500ms (2 FPS)
      streamIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 500);
    }
  };

  // Stop streaming
  const stopStreaming = async () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    
    await OvershootService.stopStreaming();
    setIsStreaming(false);
    setResult(null);
  };

  // Single frame analysis (fallback)
  const analyzeOneFrame = async () => {
    if (!cameraRef.current) return;

    setError(null);
    setIsConnecting(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
      });

      if (photo?.base64) {
        const res = await OvershootService.analyzeFrame(photo.base64);
        setResult(res);
        if (!res.success && res.error) {
          setError(res.error);
        }
      }
    } catch (e: any) {
      setError(e.message);
    }

    setIsConnecting(false);
  };

  // Permission loading
  if (!permission) {
    return (
      <View style={styles.cameraContainer}>
        <Text style={styles.statusText}>Loading camera...</Text>
      </View>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View style={styles.cameraContainer}>
        <Text style={styles.statusText}>Camera Access Required</Text>
        <Text style={styles.subText}>ClearPath needs camera to detect surroundings</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtnSimple} onPress={onBack}>
          <Text style={styles.backBtnTextSimple}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      {/* Camera View */}
      <CameraView 
        ref={cameraRef}
        style={styles.camera} 
        facing="back"
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ClearPath</Text>
        <View style={[
          styles.statusDot, 
          isStreaming && styles.statusDotStreaming,
          isConnecting && styles.statusDotConnecting
        ]} />
      </View>

      {/* Debug Panel */}
      <View style={styles.debugOverlay}>
        <Text style={styles.debugOverlayTitle}>
          {isStreaming ? `🟢 Streaming (${framesSent} frames)` : '⚫ Ready'}
        </Text>
        <Text style={styles.debugOverlayStatus}>
          WS: {OvershootService.getConnectionStatus()}
        </Text>
        <ScrollView style={styles.debugOverlayScroll}>
          {debugLogs.slice(-6).map((log, i) => (
            <Text key={i} style={styles.debugOverlayText}>{log}</Text>
          ))}
        </ScrollView>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results Display */}
      {result?.description && (
        <View style={styles.resultsBox}>
          <Text style={styles.resultsTitle}>🎯 AI Detection</Text>
          <ScrollView style={styles.resultsScroll}>
            <Text style={styles.resultsText}>{result.description}</Text>
          </ScrollView>
          {result.processingTime > 0 && (
            <Text style={styles.latencyText}>{result.processingTime}ms</Text>
          )}
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {/* Stream button */}
        <TouchableOpacity
          style={[
            styles.streamButton, 
            isStreaming && styles.stopButton,
            isConnecting && styles.connectingButton
          ]}
          onPress={isStreaming ? stopStreaming : startStreaming}
          disabled={isConnecting}
        >
          <Text style={styles.streamButtonText}>
            {isConnecting ? '⏳ Connecting...' : isStreaming ? '⏹ Stop' : '▶️ Stream'}
          </Text>
        </TouchableOpacity>

        {/* Single capture button */}
        <TouchableOpacity
          style={[styles.captureButton, isConnecting && styles.captureButtonDisabled]}
          onPress={analyzeOneFrame}
          disabled={isConnecting || isStreaming}
        >
          <Text style={styles.captureButtonText}>📸</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Component
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
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 50,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '200',
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },

  // Status Panel
  statusPanel: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusLabel: {
    color: '#888',
    fontSize: 13,
  },
  statusValue: {
    color: '#ccc',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusGood: {
    color: '#4ade80',
  },
  warningBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  warningTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 11,
  },

  // Debug Panel
  debugPanel: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    maxHeight: 150,
  },
  debugTitle: {
    color: '#666',
    fontSize: 11,
    marginBottom: 5,
  },
  debugLogs: {
    flex: 1,
  },
  debugLogText: {
    color: '#555',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 1,
  },

  startButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 25,
  },
  startButtonDisabled: {
    backgroundColor: '#444',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    color: '#444',
    fontSize: 11,
  },

  // Camera Screen
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  subText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  permissionButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  backBtnSimple: {
    marginTop: 15,
    alignSelf: 'center',
  },
  backBtnTextSimple: {
    color: '#888',
    fontSize: 14,
  },

  // Header
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666',
  },
  statusDotStreaming: {
    backgroundColor: '#22c55e',
  },
  statusDotConnecting: {
    backgroundColor: '#fbbf24',
  },

  // Debug Overlay
  debugOverlay: {
    position: 'absolute',
    top: 100,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 8,
    padding: 10,
    zIndex: 10,
    maxHeight: 150,
  },
  debugOverlayTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  debugOverlayStatus: {
    color: '#888',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  debugOverlayScroll: {
    maxHeight: 80,
  },
  debugOverlayText: {
    color: '#666',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 1,
  },

  // Error
  errorBox: {
    position: 'absolute',
    bottom: 200,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: 8,
    padding: 12,
    zIndex: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },

  // Results
  resultsBox: {
    position: 'absolute',
    bottom: 100,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
    borderRadius: 10,
    padding: 12,
    zIndex: 10,
    maxHeight: 150,
  },
  resultsTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  resultsScroll: {
    maxHeight: 80,
  },
  resultsText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  latencyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 5,
  },

  // Controls
  controls: {
    position: 'absolute',
    bottom: 35,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    zIndex: 10,
  },
  streamButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 35,
    borderRadius: 25,
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  connectingButton: {
    backgroundColor: '#fbbf24',
  },
  streamButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  captureButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonText: {
    fontSize: 22,
  },
});

export default HomeScreen;
