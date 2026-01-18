/**
 * ClearPath - Indoor Navigation for Everyone
 * 
 * Simplified UI using UnifiedNavigationService
 * 
 * Flow:
 * 1. User taps "Navigate" → speaks destination
 * 2. User confirms transcription
 * 3. Navigation auto-starts: first step is spoken, then Overshoot AI activates
 * 4. Voice commands work (next/previous/repeat/stop)
 * 5. User taps "End Navigation" or says "stop" to finish
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

// Typewriter component that types out text letter by letter
const TypewriterText = ({ 
  text, 
  delay = 0, 
  speed = 80, 
  onComplete,
  style,
}: { 
  text: string; 
  delay?: number; 
  speed?: number; 
  onComplete?: () => void;
  style?: any;
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    if (displayedText.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, speed);
      return () => clearTimeout(timer);
    } else if (onComplete) {
      onComplete();
    }
  }, [started, displayedText, text, speed, onComplete]);

  return <Text style={style}>{displayedText}</Text>;
};

// Voice options
const voices = ["Mark", "Sarah", "James", "Emily"];

// Landing Page Component
const LandingPage = ({ onStart }: { onStart: () => void }) => {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const [line3Complete, setLine3Complete] = useState(false);
  const [uiVisible, setUiVisible] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [currentVoiceIndex, setCurrentVoiceIndex] = useState(0);
  const [uiOpacity] = useState(new (require('react-native').Animated).Value(0));

  const cycleVoice = () => {
    setCurrentVoiceIndex((prev) => (prev + 1) % voices.length);
  };

  useEffect(() => {
    if (line3Complete) {
      // Hide cursor after typing is done
      const cursorTimer = setTimeout(() => {
        setShowCursor(false);
      }, 1000);

      // Show UI after typing completes
      const uiTimer = setTimeout(() => {
        setUiVisible(true);
        require('react-native').Animated.timing(uiOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }).start();
      }, 800);

      return () => {
        clearTimeout(cursorTimer);
        clearTimeout(uiTimer);
      };
    }
  }, [line3Complete]);

  const Animated = require('react-native').Animated;

  return (
    <View style={styles.landingContainer}>
      {/* Subtle vignette effect */}
      <View style={styles.vignette} />

      {/* Header - fades in after title */}
      <Animated.View style={[styles.headerLogo, { opacity: uiOpacity }]}>
        <View style={styles.logoIconBox}>
          <Text style={styles.logoIconArrow}>▶</Text>
        </View>
        <Text style={styles.logoText}>CLEARPATH</Text>
      </Animated.View>

      {/* Main content */}
      <View style={styles.mainContent}>
        {/* ClearPath title with typewriter */}
        <TypewriterText 
          text="CLEARPATH" 
          delay={500} 
          speed={100}
          onComplete={() => setLine1Complete(true)}
          style={styles.brandText}
        />
        
        {/* Indoor Navigation */}
        {line1Complete && (
          <TypewriterText 
            text="Indoor Navigation" 
            delay={200} 
            speed={60}
            onComplete={() => setLine2Complete(true)}
            style={styles.titleText}
          />
        )}
        {!line1Complete && <Text style={styles.titleText}> </Text>}
        
        {/* for Everyone with cursor */}
        <View style={styles.subtitleRow}>
          {line2Complete && (
            <TypewriterText 
              text="for Everyone" 
              delay={200} 
              speed={70}
              onComplete={() => setLine3Complete(true)}
              style={styles.subtitleText}
            />
          )}
          {!line2Complete && <Text style={styles.subtitleText}> </Text>}
          
          {/* Blinking cursor */}
          {showCursor && line2Complete && (
            <BlinkingCursor />
          )}
        </View>

        {/* Tagline - fades in with UI */}
        <Animated.View style={{ opacity: uiOpacity, marginTop: 32 }}>
          <Text style={styles.taglineText}>
            AI-POWERED  •  VOICE-GUIDED  •  ACCESSIBLE
          </Text>
        </Animated.View>

        {/* Description - fades in with UI */}
        <Animated.View style={{ opacity: uiOpacity, marginTop: 24 }}>
          <Text style={styles.descriptionText}>
            Empowering blind and visually impaired individuals to navigate indoor spaces with confidence using AI-powered voice guidance.
          </Text>
        </Animated.View>

        {/* Buttons - fade in with UI */}
        <Animated.View style={[styles.buttonsRow, { opacity: uiOpacity }]}>
          <TouchableOpacity style={styles.getStartedButton} onPress={onStart} activeOpacity={0.8}>
            <Text style={styles.getStartedText}>GET STARTED</Text>
            <Text style={styles.getStartedArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.voiceButton} 
            onPress={cycleVoice}
            activeOpacity={0.7}
          >
            <Text style={styles.voiceButtonIcon}>🎤</Text>
            <Text style={styles.voiceButtonText}>VOICE: {voices[currentVoiceIndex].toUpperCase()}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Footer text - fades in last */}
      <Animated.View style={[styles.footerContainer, { opacity: uiOpacity }]}>
        <Text style={styles.footer}>BUILT AT NEXHACKS 2025</Text>
      </Animated.View>
    </View>
  );
};

// Blinking cursor component
const BlinkingCursor = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(v => !v);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text style={[styles.cursor, { opacity: visible ? 1 : 0 }]}>|</Text>
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
        
        // Get video stream when displaying or navigating (camera starts when directions received)
        if (state.status === 'displaying' || state.status === 'navigating') {
          const stream = UnifiedNav.getVideoStream();
          if (stream) {
            setMediaStream(stream);
          }
        } else if (state.status === 'idle' || state.status === 'completed') {
          // Clear stream when returning to idle
          setMediaStream(null);
          setVisionResult(null);
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
        return { icon: '⏳', text: 'Getting Directions...', style: styles.navButtonDisabled };
      case 'verifying':
        return { icon: '✓', text: 'Confirm', style: styles.navButtonDisabled };
      default:
        return { icon: '🎤', text: 'Navigate', style: styles.navButton };
    }
  };

  const buttonConfig = getButtonConfig();
  const isNavigating = navState.status === 'navigating';
  const showCamera = isNavigating && mediaStream;
  const showSteps = navState.status === 'navigating';

  return (
    <View style={styles.cameraContainer}>
      {/* Camera Preview - Shows when displaying directions or navigating */}
      {showCamera ? (
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 20,
    zIndex: 10,
  },
  logoIconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIconArrow: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  logoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 8,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  brandText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  titleText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '200',
    letterSpacing: -1,
    textAlign: 'center',
    minHeight: 60,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  subtitleText: {
    color: '#666',
    fontSize: 40,
    fontWeight: '200',
    letterSpacing: -1,
    textAlign: 'center',
  },
  cursor: {
    color: '#666',
    fontSize: 40,
    fontWeight: '200',
    marginLeft: 2,
  },
  taglineText: {
    color: '#666',
    fontSize: 12,
    letterSpacing: 4,
    textAlign: 'center',
  },
  descriptionText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 28,
    textAlign: 'center',
    maxWidth: 500,
    paddingHorizontal: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginTop: 48,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 40,
    minWidth: 220,
    justifyContent: 'center',
  },
  getStartedText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2,
  },
  getStartedArrow: {
    color: '#000',
    fontSize: 18,
    fontWeight: '300',
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
    paddingVertical: 18,
    paddingHorizontal: 40,
    minWidth: 220,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  voiceButtonIcon: {
    fontSize: 16,
  },
  voiceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2,
  },
  footerContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  footer: {
    color: '#444',
    fontSize: 11,
    letterSpacing: 4,
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
