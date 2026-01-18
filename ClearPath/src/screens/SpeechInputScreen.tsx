/**
 * SpeechInputScreen - First step of the navigation flow
 * 
 * This screen handles:
 * 1. User speaks their current location and destination
 * 2. Audio is recorded using expo-av
 * 3. Speech is transcribed using Wispr Flow API
 * 4. Transcript is parsed into structured JSON (building, floor, currentRoom, destinationRoom)
 * 5. Floor plan is fetched based on building and floor
 * 6. Confirmation is displayed showing parsed location and floor plan
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import VoiceService from '../services/VoiceService';
import WisprFlowService from '../services/WisprFlowService';
import { ParsedLocation } from '../types';

interface SpeechInputScreenProps {
  onComplete: (parsedLocation: ParsedLocation) => void;
  onBack: () => void;
}

export const SpeechInputScreen: React.FC<SpeechInputScreenProps> = ({
  onComplete,
  onBack,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [parsedLocation, setParsedLocation] = useState<ParsedLocation | null>(null);

  /**
   * Start recording user speech
   */
  const handleStartRecording = async () => {
    try {
      // Request microphone permission if not already granted
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Permission Required',
          'ClearPath needs microphone access to process your speech commands.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Start recording via VoiceService
      await VoiceService.startListening();
      setIsRecording(true);
      setTranscript(null);
      setParsedLocation(null);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  /**
   * Stop recording and process the speech
   * This is where we:
   * 1. Stop the recording
   * 2. Send audio to Wispr Flow for transcription
   * 3. Parse the transcript into structured JSON
   * 4. Fetch the floor plan
   */
  const handleStopRecording = async () => {
    try {
      setIsRecording(false);
      setIsProcessing(true);

      console.log('Stopping recording and processing...');

      // Stop recording and get audio URI
      const audioUri = await VoiceService.stopListening();
      console.log('Audio recorded:', audioUri);

      // Transcribe audio using Wispr Flow API
      const transcriptText = await WisprFlowService.transcribeAudio(audioUri);
      setTranscript(transcriptText);
      console.log('Transcript received:', transcriptText);

      // Parse transcript into structured location data using OpenAI
      // Extracts: floor, starting point (currentRoom), and destination (destinationRoom)
      const parsed = await WisprFlowService.parseLocationFromTranscript(transcriptText);
      setParsedLocation(parsed);
      console.log('Location parsed:', parsed);

      setIsProcessing(false);

    } catch (error) {
      console.error('Error processing speech:', error);
      setIsProcessing(false);
      setIsRecording(false);
      
      Alert.alert(
        'Processing Error',
        error instanceof Error 
          ? error.message 
          : 'Failed to process speech. Please check your Wispr Flow API key and try again.'
      );
    }
  };

  /**
   * Confirm and proceed to next step (camera/navigation)
   */
  const handleConfirm = () => {
    if (parsedLocation) {
      onComplete(parsedLocation);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Speak Your Location</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>How to use:</Text>
          <Text style={styles.instructionsText}>
            Tap the microphone button and say:
          </Text>
          <Text style={styles.exampleText}>
            "I am on floor 2. My starting point is room 203. My destination is the washroom."
          </Text>
        </View>

        {/* Recording Button */}
        <View style={styles.recordingContainer}>
          {!isRecording && !isProcessing && (
            <TouchableOpacity
              style={styles.recordButton}
              onPress={handleStartRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.recordButtonIcon}>🎤</Text>
              <Text style={styles.recordButtonText}>Tap to Speak</Text>
            </TouchableOpacity>
          )}

          {isRecording && (
            <TouchableOpacity
              style={[styles.recordButton, styles.recordButtonActive]}
              onPress={handleStopRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.recordButtonIcon}>⏹</Text>
              <Text style={styles.recordButtonText}>Stop Recording</Text>
              <View style={styles.recordingIndicator}>
                <View style={styles.pulse} />
              </View>
            </TouchableOpacity>
          )}

          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#4A90D9" />
              <Text style={styles.processingText}>Processing speech...</Text>
            </View>
          )}
        </View>

        {/* Transcript Display */}
        {transcript && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Transcript:</Text>
            <Text style={styles.resultText}>{transcript}</Text>
          </View>
        )}

        {/* Extracted Location Summary */}
        {parsedLocation && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Extracted Location Information:</Text>
            <View style={styles.extractedInfo}>
              <View style={styles.extractedItem}>
                <Text style={styles.extractedLabel}>🏢 Floor:</Text>
                <Text style={styles.extractedValue}>
                  {parsedLocation.floor > 0 ? `Floor ${parsedLocation.floor}` : 'Not specified'}
                </Text>
              </View>
              <View style={styles.extractedItem}>
                <Text style={styles.extractedLabel}>📍 Starting Point:</Text>
                <Text style={styles.extractedValue}>
                  {parsedLocation.currentRoom || 'Not specified'}
                </Text>
              </View>
              <View style={styles.extractedItem}>
                <Text style={styles.extractedLabel}>🎯 Destination:</Text>
                <Text style={styles.extractedValue}>
                  {parsedLocation.destinationRoom || 'Not specified'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Confirm Button */}
        {parsedLocation && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>Confirm & Continue</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a1a',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  backButtonText: {
    color: '#888',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  instructionsContainer: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  instructionsTitle: {
    color: '#4A90D9',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 10,
  },
  exampleText: {
    color: '#fff',
    fontSize: 14,
    fontStyle: 'italic',
    backgroundColor: '#2a2a3e',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 30,
    minHeight: 150,
    justifyContent: 'center',
  },
  recordButton: {
    backgroundColor: '#4A90D9',
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  recordButtonActive: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  recordButtonIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recordingIndicator: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
  },
  pulse: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    opacity: 0.6,
  },
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 15,
  },
  resultContainer: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  resultTitle: {
    color: '#4A90D9',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  resultText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  parsedDataContainer: {
    marginTop: 8,
  },
  parsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  parsedLabel: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  parsedValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  extractedInfo: {
    marginTop: 12,
  },
  extractedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  extractedLabel: {
    color: '#4A90D9',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  extractedValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  confirmButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    elevation: 5,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
