/**
 * TEAM MEMBER 2: Voice input recognition using expo-av and Wispr Flow
 * 
 * This service handles all voice-related functionality including:
 * - Voice input recognition via audio recording
 * - Wispr Flow integration for speech-to-text transcription
 * - Text-to-speech output
 * - Voice command parsing
 */

import { Audio } from 'expo-av';
import WisprFlowService, { ParsedLocation } from './WisprFlowService';

export class VoiceService {
  private isListening: boolean = false;
  private recording: Audio.Recording | null = null;

  /**
   * Request microphone permissions and start recording audio
   * Uses expo-av for audio recording
   */
  async startListening(): Promise<void> {
    try {
      console.log('Starting voice recording...');
      
      // Request microphone permission
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isListening = true;
      console.log('Recording started successfully');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      this.isListening = false;
      throw error;
    }
  }

  /**
   * Stop recording and return the audio file URI
   * 
   * @returns Promise<string> - URI of the recorded audio file
   */
  async stopListening(): Promise<string> {
    try {
      if (!this.recording) {
        throw new Error('No active recording');
      }

      console.log('Stopping recording...');
      
      // Stop and unload the recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      this.recording = null;
      this.isListening = false;

      if (!uri) {
        throw new Error('Recording URI is null');
      }

      console.log('Recording stopped. Audio URI:', uri);
      return uri;
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.isListening = false;
      throw error;
    }
  }

  /**
   * Record speech, transcribe it using Wispr Flow, and parse into structured location
   * This is the main method to capture user speech and extract location/destination info
   * 
   * @returns Promise<ParsedLocation> - Structured location data parsed from speech
   */
  async captureAndParseLocation(): Promise<ParsedLocation> {
    try {
      // Start recording
      await this.startListening();
      
      // Wait a moment for user to speak (or implement a manual stop)
      // For MVP, we'll assume stopListening() is called manually
      const audioUri = await this.stopListening();
      
      // Transcribe and parse using Wispr Flow
      const parsedLocation = await WisprFlowService.transcribeAndParse(audioUri);
      
      return parsedLocation;
      
    } catch (error) {
      console.error('Error in captureAndParseLocation:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech and play it to the user
   * TODO: Implement text-to-speech with LiveKit
   * @param text The text to speak
   * @param priority Priority level (high priority interrupts current speech)
   */
  async speak(text: string, priority: 'high' | 'normal' = 'normal'): Promise<void> {
    console.log(`Speaking: ${text} (priority: ${priority})`);
    // Implementation needed by Team Member 2
  }

  /**
   * Parse voice command and return structured command data
   * TODO: Implement voice command parsing
   * @param voiceInput Raw voice input string
   * @returns Parsed command object
   */
  async parseVoiceCommand(voiceInput: string): Promise<{
    command: string;
    destination?: string;
    parameters?: Record<string, any>;
  }> {
    console.log(`Parsing voice command: ${voiceInput}`);
    // Implementation needed by Team Member 2
    return { command: 'unknown' };
  }

  /**
   * Provide haptic feedback along with voice output
   * TODO: Integrate haptic feedback for navigation cues
   */
  async provideHapticFeedback(pattern: 'success' | 'warning' | 'direction'): Promise<void> {
    console.log(`Haptic feedback: ${pattern}`);
    // Implementation needed by Team Member 2
  }

  /**
   * Get current listening status
   */
  getStatus(): boolean {
    return this.isListening;
  }
}

export default new VoiceService();
