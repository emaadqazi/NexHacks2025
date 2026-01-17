/**
 * TEAM MEMBER 4: UI/UX - camera view, voice controls, testing
 * 
 * Home Screen - Main navigation interface
 * Integrates camera view, voice controls, and navigation UI
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';

export const HomeScreen: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    console.log('Initializing ClearPath services...');
  }, []);

  // Permission still loading
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  // Permission not granted - show button to request
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera access needed</Text>
        <Text style={styles.subtext}>ClearPath needs camera access for navigation</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Permission granted - show camera
  return (
    <View style={styles.container}>
      <ExpoCameraView style={styles.camera}>
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Camera Ready</Text>
          <Text style={styles.subtext}>Object detection will appear here</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.voiceButton}>
            <Text style={styles.voiceButtonText}>🎤 Tap to Speak</Text>
          </TouchableOpacity>
        </View>
      </ExpoCameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  text: {
    color: '#fff',
    fontSize: 24,
    marginBottom: 10,
  },
  subtext: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
  overlay: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  voiceButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
  },
  voiceButtonText: {
    color: '#fff',
    fontSize: 20,
  },
});
