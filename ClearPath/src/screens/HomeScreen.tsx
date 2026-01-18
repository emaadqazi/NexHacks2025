/**
 * ClearPath - Indoor Navigation for Everyone
 * 
 * Simplified UI using UnifiedNavigationService
 * 
 * Flow:
 * 1. User taps "Navigate" → speaks destination
 * 2. User confirms transcription
 * 3. Steps displayed → user taps "Start Navigation"
 * 4. Active navigation with voice commands (next/previous/repeat)
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform, ScrollView, ActivityIndicator } from 'react-native';
import UnifiedNav, { NavigationState, NavigationStatus } from '../services/UnifiedNavigationService';
import { NavigationStep } from '../services/NavigationStepsManager';
import { DetectionResponse } from '../services/OvershootService';

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

// Navigation Screen Component
const NavigationScreen = ({ onBack }: { onBack: () => void }) => {
  // State from UnifiedNavigationService
  const [navState, setNavState] = useState<NavigationState>(UnifiedNav.getState());
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [visionResult, setVisionResult] = useState<DetectionResponse | null>(null);
  const [currentSpeech, setCurrentSpeech] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [transcribedQuery, setTranscribedQuery] = useState<string | null>(null);

  // Setup callbacks on mount
  useEffect(() => {
    UnifiedNav.setCallbacks({
      onStateChange: (state) => {
        setNavState(state);
        
        // Get video stream when navigating starts
        if (state.status === 'navigating') {
          const stream = UnifiedNav.getVideoStream();
          setMediaStream(stream);
        }
      },
      onStepChange: (step, index, total) => {
        console.log(`[NavigationScreen] Step ${index + 1}/${total}: ${step.instruction}`);
      },
      onVisionUpdate: (result) => {
        setVisionResult(result);
      },
      onSpeaking: (text) => {
        setCurrentSpeech(text);
        // Clear speech display after 4 seconds
        setTimeout(() => setCurrentSpeech(''), 4000);
      },
      onError: (err) => {
        setError(err);
        setTimeout(() => setError(null), 5000);
      },
    });

    return () => {
      // Cleanup on unmount
      UnifiedNav.reset();
    };
  }, []);

  // Handle Navigate button press
  const handleNavigatePress = async () => {
    const status = navState.status;

    if (status === 'idle' || status === 'error' || status === 'completed') {
      // Start listening for destination
      await UnifiedNav.startListening();
    } else if (status === 'listening') {
      // Stop listening and verify
      const query = await UnifiedNav.stopListeningAndVerify();
      if (query) {
        setTranscribedQuery(query);
      }
    } else if (status === 'navigating') {
      // Stop navigation
      await UnifiedNav.stopNavigation();
      setMediaStream(null);
      setVisionResult(null);
    }
  };

  // Handle Start Navigation button (after steps are displayed)
  const handleStartNavigation = async () => {
    await UnifiedNav.startActiveNavigation();
  };

  // Handle confirmation of transcription
  const handleConfirmQuery = async () => {
    if (transcribedQuery) {
      setTranscribedQuery(null);
      await UnifiedNav.requestDirections(transcribedQuery);
    }
  };

  // Handle re-recording
  const handleRerecord = () => {
    setTranscribedQuery(null);
    UnifiedNav.cancelListening();
    UnifiedNav.startListening();
  };

  // Handle back button
  const handleBack = () => {
    UnifiedNav.reset();
    setMediaStream(null);
    setVisionResult(null);
    onBack();
  };

  // Get button text and icon based on status
  const getButtonConfig = () => {
    switch (navState.status) {
      case 'listening':
        return { icon: '⏹️', text: 'Stop Recording', style: styles.navButtonListening };
      case 'navigating':
        return { icon: '🛑', text: 'End Navigation', style: styles.navButtonActive };
      case 'requesting':
        return { icon: '⏳', text: 'Loading...', style: styles.navButtonDisabled };
      case 'verifying':
        return { icon: '✓', text: 'Confirm', style: styles.navButtonDisabled };
      case 'displaying':
        return { icon: '🗺️', text: 'Navigate', style: styles.navButton };
      default:
        return { icon: '🎤', text: 'Navigate', style: styles.navButton };
    }
  };

  const buttonConfig = getButtonConfig();
  const isNavigating = navState.status === 'navigating';
  const showSteps = navState.status === 'displaying' || navState.status === 'navigating';
  const showStartButton = navState.status === 'displaying';

  return (
    <View style={styles.cameraContainer}>
      {/* Camera Preview - Full Screen when navigating */}
      {isNavigating && mediaStream ? (
        <VideoPreview mediaStream={mediaStream} />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderIcon}>
            {navState.status === 'listening' ? '🎤' : 
             navState.status === 'requesting' ? '⏳' : '📍'}
          </Text>
          <Text style={styles.placeholderText}>
            {navState.status === 'listening' ? 'Listening for your destination...' :
             navState.status === 'requesting' ? 'Getting directions...' :
             navState.status === 'displaying' ? 'Ready to navigate!' :
             'Tap Navigate to begin'}
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerRight}>
          {isNavigating && (
            <View style={styles.voiceCommandHint}>
              <Text style={styles.voiceCommandText}>
                Say: "next" • "previous" • "repeat"
              </Text>
            </View>
          )}
          <View style={[styles.statusDot, isNavigating && styles.statusDotActive]} />
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Current Speech Display */}
      {currentSpeech && (
        <View style={styles.speechBanner}>
          <Text style={styles.speechIcon}>🔊</Text>
          <Text style={styles.speechText}>{currentSpeech}</Text>
        </View>
      )}

      {/* Verification Modal */}
      {navState.status === 'verifying' && transcribedQuery && (
        <View style={styles.verificationModal}>
          <Text style={styles.verificationTitle}>Is this correct?</Text>
          <Text style={styles.verificationQuery}>"{transcribedQuery}"</Text>
          <View style={styles.verificationButtons}>
            <TouchableOpacity style={styles.rerecordButton} onPress={handleRerecord}>
              <Text style={styles.rerecordButtonText}>Re-record</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmQuery}>
              <Text style={styles.confirmButtonText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading Overlay */}
      {navState.status === 'requesting' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Getting directions...</Text>
        </View>
      )}

      {/* Navigation Steps Panel */}
      {showSteps && navState.steps.length > 0 && (
        <View style={styles.navStepsPanel}>
          <View style={styles.navStepsHeader}>
            <Text style={styles.navStepsTitle}>
              📍 Directions {isNavigating && `(${navState.currentStepIndex + 1}/${navState.totalSteps})`}
            </Text>
          </View>
          <ScrollView style={styles.navStepsScroll}>
            {navState.steps.map((step, index) => (
              <View 
                key={index} 
                style={[
                  styles.stepItem,
                  index === navState.currentStepIndex && isNavigating && styles.stepItemCurrent,
                  index < navState.currentStepIndex && isNavigating && styles.stepItemCompleted,
                ]}
              >
                <Text style={[
                  styles.stepNumber,
                  index === navState.currentStepIndex && isNavigating && styles.stepNumberCurrent,
                ]}>
                  {index + 1}
                </Text>
                <Text style={[
                  styles.stepText,
                  index === navState.currentStepIndex && isNavigating && styles.stepTextCurrent,
                  index < navState.currentStepIndex && isNavigating && styles.stepTextCompleted,
                ]}>
                  {step.instruction}
                </Text>
              </View>
            ))}
          </ScrollView>
          
          {/* Start Navigation Button */}
          {showStartButton && (
            <TouchableOpacity style={styles.startNavButton} onPress={handleStartNavigation}>
              <Text style={styles.startNavButtonText}>🚀 Start Navigation</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Vision Results Overlay (during navigation) */}
      {isNavigating && visionResult?.rawResult && (
        <View style={styles.visionOverlay}>
          <Text style={styles.visionText}>{visionResult.rawResult}</Text>
        </View>
      )}

      {/* Progress Bar (during navigation) */}
      {isNavigating && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((navState.currentStepIndex + 1) / navState.totalSteps) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            Step {navState.currentStepIndex + 1} of {navState.totalSteps}
          </Text>
        </View>
      )}

      {/* Main Action Button */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.navButton, buttonConfig.style]}
          onPress={handleNavigatePress}
          disabled={navState.status === 'requesting' || navState.status === 'verifying'}
        >
          <Text style={styles.navButtonIcon}>{buttonConfig.icon}</Text>
          <Text style={styles.navButtonText}>{buttonConfig.text}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main HomeScreen Component
export const HomeScreen = () => {
  const [showNavigation, setShowNavigation] = useState(false);

  if (showNavigation) {
    return <NavigationScreen onBack={() => setShowNavigation(false)} />;
  }

  return <LandingPage onStart={() => setShowNavigation(true)} />;
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

  // Navigation Screen
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
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.7,
  },
  placeholderText: {
    color: '#666',
    fontSize: 18,
    letterSpacing: 1,
    textAlign: 'center',
    paddingHorizontal: 40,
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
  voiceCommandHint: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  voiceCommandText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  statusDotActive: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  // Banners
  errorBanner: {
    position: 'absolute',
    top: 120,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  speechBanner: {
    position: 'absolute',
    top: 120,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  speechIcon: {
    fontSize: 20,
  },
  speechText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },

  // Verification Modal
  verificationModal: {
    position: 'absolute',
    top: '30%',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    zIndex: 25,
    borderWidth: 2,
    borderColor: 'rgba(0, 122, 255, 0.5)',
  },
  verificationTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  verificationQuery: {
    color: '#fff',
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
    lineHeight: 26,
  },
  verificationButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  rerecordButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  rerecordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: '40%',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    zIndex: 25,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },

  // Navigation Steps Panel
  navStepsPanel: {
    position: 'absolute',
    top: 170,
    left: 16,
    right: 16,
    maxHeight: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.5)',
    zIndex: 15,
  },
  navStepsHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  navStepsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navStepsScroll: {
    maxHeight: 250,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  stepItemCurrent: {
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  stepItemCompleted: {
    opacity: 0.5,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
  stepNumberCurrent: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
  },
  stepText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  stepTextCurrent: {
    fontWeight: '600',
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
  },
  startNavButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    paddingVertical: 16,
    margin: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  startNavButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  // Vision Overlay
  visionOverlay: {
    position: 'absolute',
    bottom: 200,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 16,
    padding: 16,
    zIndex: 10,
  },
  visionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Progress Bar
  progressContainer: {
    position: 'absolute',
    bottom: 140,
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 3,
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 6,
    opacity: 0.7,
  },

  // Bottom Controls
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  navButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 180,
    justifyContent: 'center',
  },
  navButtonListening: {
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
  },
  navButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(100, 100, 100, 0.9)',
  },
  navButtonIcon: {
    fontSize: 20,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default HomeScreen;
