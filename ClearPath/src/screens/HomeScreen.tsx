/**
 * TEAM MEMBER 4: UI/UX - camera view, voice controls, testing
 * 
 * Home Screen - Main navigation interface
 * Landing page with camera functionality and speech input flow
 */

import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';
import { SpeechInputScreen } from './SpeechInputScreen';
import { ParsedLocation } from '../types';

// Landing Page Component
const LandingPage: React.FC<{ onStart: () => void; onCamera: () => void }> = ({ onStart, onCamera }) => {
  return (
    <View style={styles.landingContainer}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />
      
      {/* Logo and Title */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>🧭</Text>
        <Text style={styles.title}>ClearPath</Text>
        <Text style={styles.tagline}>Indoor Navigation for Everyone</Text>
      </View>

      {/* Features */}
      <View style={styles.featuresContainer}>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📷</Text>
          <Text style={styles.featureText}>Real-time Object Detection</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🎤</Text>
          <Text style={styles.featureText}>Voice Commands</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🗺️</Text>
          <Text style={styles.featureText}>Turn-by-Turn Navigation</Text>
        </View>
      </View>

      {/* Buttons Row */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.startButton} onPress={onStart}>
          <Text style={styles.startButtonText}>Click Me</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cameraButton} onPress={onCamera}>
          <Text style={styles.cameraButtonText}>📷 Camera</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>NexHacks 2025</Text>
    </View>
  );
};

// Camera Screen Component
const CameraScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [permission, requestPermission] = useCameraPermissions();

  // Permission still loading
  if (!permission) {
    return (
      <View style={styles.cameraContainer}>
        <Text style={styles.cameraText}>Loading camera...</Text>
      </View>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View style={styles.cameraContainer}>
        <Text style={styles.cameraText}>Camera Access Needed</Text>
        <Text style={styles.cameraSubtext}>
          ClearPath needs camera access for navigation assistance
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Camera view
  return (
    <View style={styles.cameraContainer}>
      {/* Camera in background */}
      <ExpoCameraView style={styles.camera} />
      
      {/* Top overlay - OUTSIDE camera view for touch events */}
      <View style={styles.topOverlay}>
        <TouchableOpacity style={styles.backButtonCamera} onPress={onBack}>
          <Text style={styles.backButtonCameraText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.cameraTitle}>ClearPath</Text>
      </View>

      {/* Center info */}
      <View style={styles.centerOverlay}>
        <Text style={styles.cameraReadyText}>📷 Camera Active</Text>
        <Text style={styles.cameraHint}>Point at your surroundings</Text>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomOverlay}>
        <TouchableOpacity style={styles.voiceButton} onPress={() => console.log('Voice button pressed')}>
          <Text style={styles.voiceButtonText}>🎤 Tap to Speak</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main HomeScreen Component
export const HomeScreen: React.FC = () => {
  const [showCamera, setShowCamera] = useState(false);
  const [showSpeechInput, setShowSpeechInput] = useState(false);
  const [parsedLocation, setParsedLocation] = useState<ParsedLocation | null>(null);

  // Handle speech input completion - proceed to camera view
  const handleSpeechInputComplete = (location: ParsedLocation) => {
    setParsedLocation(location);
    setShowSpeechInput(false);
    setShowCamera(true);
    console.log('Speech input completed. Location:', location);
  };

  // Show speech input screen first (before camera)
  if (showSpeechInput) {
    return (
      <SpeechInputScreen
        onComplete={handleSpeechInputComplete}
        onBack={() => setShowSpeechInput(false)}
      />
    );
  }

  // Show camera screen (either after speech input or directly from landing)
  if (showCamera) {
    return (
      <CameraScreen
        onBack={() => {
          setShowCamera(false);
          // If we came from speech input (have a parsed location), go back there
          // Otherwise go back to landing page
          if (parsedLocation) {
            setShowSpeechInput(true);
          }
        }}
      />
    );
  }

  // Landing page - user clicks "Click Me" to begin with speech input, or "Camera" to go directly to camera
  return (
    <LandingPage 
      onStart={() => setShowSpeechInput(true)} 
      onCamera={() => setShowCamera(true)}
    />
  );
};

const styles = StyleSheet.create({
  // Landing Page Styles
  landingContainer: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a1a',
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
  buttonsRow: {
    flexDirection: 'row',
    gap: 15,
  },
  startButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 18,
    paddingHorizontal: 35,
    borderRadius: 30,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    letterSpacing: 1,
  },
  cameraButton: {
    backgroundColor: '#2ECC71',
    paddingVertical: 18,
    paddingHorizontal: 35,
    borderRadius: 30,
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 18,
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    color: '#444',
    fontSize: 14,
  },

  // Camera Screen Styles
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
  cameraText: {
    color: '#fff',
    fontSize: 24,
    marginBottom: 15,
  },
  cameraSubtext: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 20,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#888',
    fontSize: 16,
  },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButtonCamera: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  backButtonCameraText: {
    color: '#fff',
    fontSize: 16,
  },
  cameraTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
    marginRight: 60,
  },
  centerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraReadyText: {
    color: '#fff',
    fontSize: 24,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  cameraHint: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  voiceButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  voiceButtonText: {
    color: '#fff',
    fontSize: 18,
  },
});
