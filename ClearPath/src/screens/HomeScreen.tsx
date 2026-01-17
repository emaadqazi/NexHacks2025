/**
 * TEAM MEMBER 4: UI/UX - camera view, voice controls, testing
 * 
 * Home Screen - Main navigation interface
 * Integrates camera view, voice controls, and navigation UI
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { CameraView } from '../components/CameraView';
import { VoiceButton } from '../components/VoiceButton';
import { NavigationUI } from '../components/NavigationUI';
import { NavigationInstruction } from '../types';
import NavigationService from '../services/NavigationService';
import VoiceService from '../services/VoiceService';

export const HomeScreen: React.FC = () => {
  const [currentInstruction, setCurrentInstruction] = useState<NavigationInstruction | null>(null);
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);

  useEffect(() => {
    // Initialize services
    initializeServices();
  }, []);

  const initializeServices = async () => {
    // TODO: Initialize all services on app start
    console.log('Initializing ClearPath services...');
  };

  const handleVoiceCommand = async (command: string) => {
    // TODO: Process voice commands and trigger navigation
    console.log('Voice command received:', command);
    await VoiceService.speak(`Navigating to ${command}`);
  };

  const handleObjectDetection = (objects: any[]) => {
    // TODO: Handle detected objects (obstacles, signs, etc.)
    console.log('Objects detected:', objects);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Camera view in background */}
      <View style={styles.cameraContainer}>
        <CameraView onObjectDetected={handleObjectDetection} />
      </View>

      {/* Navigation overlay */}
      <View style={styles.overlay}>
        <NavigationUI
          instruction={currentInstruction}
          distanceToDestination={distanceToDestination}
        />
      </View>

      {/* Voice control button at bottom */}
      <View style={styles.controlsContainer}>
        <VoiceButton onCommand={handleVoiceCommand} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
