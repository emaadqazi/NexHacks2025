/**
 * Unified Navigation Service
 * 
 * Single orchestration service for the complete navigation workflow:
 * 1. User speaks destination → WisprFlow transcribes
 * 2. Gemini generates step-by-step directions
 * 3. User clicks "Start" → Speak first steps + start Overshoot
 * 4. During navigation: listen for voice commands (next/previous/repeat)
 * 5. Voice commands temporarily mute Overshoot and speak LLM steps
 * 
 * State Machine:
 * idle -> listening -> verifying -> requesting -> displaying -> navigating -> completed
 */

import WisprFlowService, { VoiceCommand } from './WisprFlow';
import { OvershootService, DetectionResponse } from './OvershootService';
import { GeminiNavigationService, NavigationResult } from './geminiPathfinding';
import NavigationStepsManager, { NavigationStep, ParsedNavigation } from './NavigationStepsManager';
import ElevenLabsService from './ElevenLabsTTS';

// Navigation states
export type NavigationStatus = 
  | 'idle'           // Not navigating
  | 'listening'      // Recording user's destination query
  | 'verifying'      // User confirming transcription
  | 'requesting'     // Calling Gemini API
  | 'displaying'     // Showing steps, waiting for user to start
  | 'navigating'     // Active navigation with Overshoot + voice commands
  | 'completed'      // Reached destination
  | 'error';         // Error state

export interface NavigationState {
  status: NavigationStatus;
  userQuery?: string;
  currentFloor?: string;
  steps: NavigationStep[];
  currentStepIndex: number;
  totalSteps: number;
  error?: string;
  isOvershootMuted: boolean;
}

export interface UnifiedNavCallbacks {
  onStateChange: (state: NavigationState) => void;
  onStepChange: (step: NavigationStep, index: number, total: number) => void;
  onVisionUpdate: (result: DetectionResponse) => void;
  onSpeaking: (text: string) => void;
  onError: (error: string) => void;
}

/**
 * Unified Navigation Service Class
 */
export class UnifiedNavigationService {
  private wispr: typeof WisprFlowService;
  private overshoot: OvershootService;
  private gemini: GeminiNavigationService | null = null;
  private stepsManager: typeof NavigationStepsManager;
  private tts: typeof ElevenLabsService;
  
  private state: NavigationState;
  private callbacks: UnifiedNavCallbacks | null = null;
  private overshootMuted: boolean = false;
  private lastOvershootResult: DetectionResponse | null = null;
  private isSpeakingNavStep: boolean = false; // True when speaking navigation steps
  private lastOvershootSpeechTime: number = 0; // Throttle Overshoot speech
  private readonly OVERSHOOT_SPEECH_INTERVAL = 5000; // Min 5 seconds between Overshoot announcements

  constructor() {
    this.wispr = WisprFlowService;
    this.overshoot = new OvershootService();
    this.stepsManager = NavigationStepsManager;
    this.tts = ElevenLabsService;
    
    // Initialize Gemini service
    try {
      this.gemini = new GeminiNavigationService(undefined, 'minimal');
      console.log('[UnifiedNav] Gemini service initialized');
    } catch (error) {
      console.error('[UnifiedNav] Failed to initialize Gemini:', error);
    }

    // Initialize state
    this.state = this.getInitialState();
  }

  private getInitialState(): NavigationState {
    return {
      status: 'idle',
      steps: [],
      currentStepIndex: 0,
      totalSteps: 0,
      isOvershootMuted: false,
    };
  }

  /**
   * Register callbacks for state updates
   */
  setCallbacks(callbacks: UnifiedNavCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Get current navigation state
   */
  getState(): NavigationState {
    return { ...this.state };
  }

  /**
   * Update state and notify callbacks
   */
  private updateState(updates: Partial<NavigationState>): void {
    this.state = { ...this.state, ...updates };
    this.callbacks?.onStateChange(this.state);
  }

  // ==================== PHASE 1: Get Destination ====================

  /**
   * Start listening for destination query
   */
  async startListening(): Promise<boolean> {
    if (this.state.status !== 'idle' && this.state.status !== 'error') {
      console.warn('[UnifiedNav] Cannot start listening in current state:', this.state.status);
      return false;
    }

    this.updateState({ status: 'listening', error: undefined });
    
    const started = await this.wispr.startRecording();
    if (!started) {
      this.updateState({ status: 'error', error: 'Failed to start microphone' });
      this.callbacks?.onError('Failed to start microphone. Check permissions.');
      return false;
    }

    console.log('[UnifiedNav] Listening for destination...');
    return true;
  }

  /**
   * Stop listening and get transcription for verification
   */
  async stopListeningAndVerify(): Promise<string | null> {
    if (this.state.status !== 'listening') {
      console.warn('[UnifiedNav] Not currently listening');
      return null;
    }

    const query = await this.wispr.stopRecordingAndTranscribe();
    
    if (!query || query.trim().length === 0) {
      this.updateState({ status: 'error', error: 'Could not understand speech' });
      this.callbacks?.onError('Could not understand. Please try again.');
      return null;
    }

    this.updateState({ status: 'verifying', userQuery: query });
    console.log('[UnifiedNav] Transcribed:', query);
    return query;
  }

  /**
   * Cancel listening and return to idle
   */
  cancelListening(): void {
    this.wispr.cancelRecording();
    this.updateState({ status: 'idle', userQuery: undefined });
  }

  // ==================== PHASE 2: Get Directions ====================

  /**
   * Request navigation directions from Gemini
   * Automatically starts navigation after directions are received
   */
  async requestDirections(query: string): Promise<boolean> {
    if (!this.gemini) {
      this.updateState({ status: 'error', error: 'Navigation service unavailable' });
      this.callbacks?.onError('Navigation service not configured.');
      return false;
    }

    this.updateState({ status: 'requesting', userQuery: query });
    console.log('[UnifiedNav] Requesting directions for:', query);

    try {
      const result = await this.gemini.navigate(query, false);
      
      if (!result || !result.response) {
        throw new Error('No response from navigation service');
      }

      // Parse steps from response
      const parsed = this.stepsManager.parseSteps(result.response);
      
      if (parsed.steps.length === 0) {
        throw new Error('Could not parse navigation steps');
      }

      // Start camera preview (Overshoot streaming but muted)
      // Don't pass a custom prompt - let Overshoot use its default prompt
      this.overshootMuted = true;
      this.isSpeakingNavStep = false;
      this.lastOvershootSpeechTime = 0;
      
      await this.overshoot.startStreaming(
        (res) => this.handleOvershootResult(res)
        // No custom prompt - uses default from OvershootService
      );

      this.updateState({
        status: 'navigating', // Go directly to navigating
        userQuery: query,
        currentFloor: result.floor,
        steps: parsed.steps,
        currentStepIndex: 0,
        totalSteps: parsed.steps.length,
        isOvershootMuted: true,
      });

      console.log(`[UnifiedNav] Got ${parsed.steps.length} steps, auto-starting navigation`);

      // Auto-start: speak first step, then unmute Overshoot
      await this.autoStartNavigation();
      
      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[UnifiedNav] Direction request failed:', errorMsg);
      this.updateState({ status: 'error', error: errorMsg });
      this.callbacks?.onError(`Could not get directions: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Auto-start navigation after directions received
   * Speaks first step, waits, then enables Overshoot
   */
  private async autoStartNavigation(): Promise<void> {
    // Speak ONLY the first step
    const firstStepText = this.stepsManager.getCurrentStepForSpeech();
    await this.speak(firstStepText);

    // Wait for speech to fully settle
    await this.delay(1000);

    // NOW unmute Overshoot AI (uses its default prompt)
    this.overshootMuted = false;
    this.lastOvershootSpeechTime = Date.now(); // Reset timer to give a pause before first Overshoot speech
    this.updateState({ isOvershootMuted: false });

    // Start voice command listening
    this.wispr.startContinuousListening((command) => this.handleVoiceCommand(command));

    console.log('[UnifiedNav] Navigation auto-started, Overshoot unmuted');
  }

  // ==================== PHASE 3: Active Navigation ====================

  /**
   * Start active navigation (legacy method - navigation now auto-starts)
   * Kept for backward compatibility
   */
  async startActiveNavigation(): Promise<boolean> {
    // Navigation now auto-starts after directions are received
    // This method is kept for backward compatibility
    if (this.state.status === 'navigating') {
      console.log('[UnifiedNav] Already navigating');
      return true;
    }
    
    console.warn('[UnifiedNav] startActiveNavigation called but navigation auto-starts now');
    return false;
  }

  /**
   * Helper to wait/delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle Overshoot vision results
   */
  private handleOvershootResult(result: DetectionResponse): void {
    this.lastOvershootResult = result;
    this.callbacks?.onVisionUpdate(result);

    // Don't speak if:
    // - Overshoot is muted
    // - Currently speaking navigation steps
    // - TTS is already speaking
    // - Not enough time has passed since last Overshoot speech
    if (this.overshootMuted || this.isSpeakingNavStep) {
      return;
    }

    if (!result.success || !result.rawResult) {
      return;
    }

    const now = Date.now();
    const timeSinceLastSpeech = now - this.lastOvershootSpeechTime;
    
    if (timeSinceLastSpeech < this.OVERSHOOT_SPEECH_INTERVAL) {
      return; // Throttle - too soon since last announcement
    }

    if (this.tts.isCurrentlySpeaking()) {
      return; // Don't interrupt ongoing speech
    }

    const text = result.rawResult;
    const isImportant = this.isImportantOvershootResult(text);
    
    if (isImportant) {
      this.lastOvershootSpeechTime = now;
      // Use TTS directly without triggering onSpeaking callback for Overshoot
      this.tts.speak(text);
    }
  }

  /**
   * Check if Overshoot result is important enough to announce
   */
  private isImportantOvershootResult(text: string): boolean {
    const importantKeywords = [
      'obstacle', 'person', 'stairs', 'step', 'door', 'turn',
      'caution', 'warning', 'ahead', 'left', 'right', 'room',
      'elevator', 'exit', 'sign'
    ];
    
    const lowerText = text.toLowerCase();
    return importantKeywords.some(kw => lowerText.includes(kw));
  }

  /**
   * Handle voice commands during navigation
   */
  private async handleVoiceCommand(command: VoiceCommand): Promise<void> {
    console.log('[UnifiedNav] Voice command received:', command);

    // Mute Overshoot while speaking navigation steps
    this.muteOvershoot();

    // Stop any current speech
    this.tts.stop();

    switch (command) {
      case 'next':
        await this.handleNextStep();
        break;
      case 'previous':
        await this.handlePreviousStep();
        break;
      case 'repeat':
        await this.handleRepeatStep();
        break;
      case 'stop':
        await this.stopNavigation();
        return; // Don't unmute - we're stopping
      case 'where':
        await this.handleWhereAmI();
        break;
      case 'help':
        await this.handleHelp();
        break;
    }

    // Resume Overshoot after speaking, with a delay before it can speak again
    setTimeout(() => {
      this.unmuteOvershoot();
      this.lastOvershootSpeechTime = Date.now(); // Reset timer to give pause before Overshoot speaks
    }, 500);
  }

  private async handleNextStep(): Promise<void> {
    const nextStep = this.stepsManager.getNextStep();
    
    if (nextStep) {
      this.updateState({ currentStepIndex: this.stepsManager.getCurrentStepIndex() });
      this.callbacks?.onStepChange(nextStep, nextStep.index, this.state.totalSteps);
      
      const speechText = this.stepsManager.getCurrentStepForSpeech();
      await this.speak(speechText);

      // Check if this is the last step - let user know
      if (this.stepsManager.isAtLastStep()) {
        await this.delay(300);
        await this.speak("This is the final step. You're almost there!");
      }
    } else {
      // Already at last step - repeat it and remind user
      const currentStep = this.stepsManager.getCurrentStep();
      if (currentStep) {
        await this.speak(`You're on the final step. ${currentStep.instruction} Say 'stop' when you arrive.`);
      } else {
        await this.speak("Navigation complete. Say 'stop' to end.");
      }
    }
  }

  private async handlePreviousStep(): Promise<void> {
    const prevStep = this.stepsManager.getPreviousStep();
    
    if (prevStep) {
      this.updateState({ currentStepIndex: this.stepsManager.getCurrentStepIndex() });
      this.callbacks?.onStepChange(prevStep, prevStep.index, this.state.totalSteps);
      
      const speechText = this.stepsManager.getCurrentStepForSpeech();
      await this.speak(speechText);
    } else {
      await this.speak("You're at the first step.");
    }
  }

  private async handleRepeatStep(): Promise<void> {
    const speechText = this.stepsManager.getCurrentStepForSpeech();
    await this.speak(speechText);
  }

  private async handleWhereAmI(): Promise<void> {
    const progress = this.stepsManager.getProgress();
    const currentStep = this.stepsManager.getCurrentStep();
    
    const text = `You are on step ${progress.current} of ${progress.total}. ${currentStep?.instruction || ''}`;
    await this.speak(text);
  }

  private async handleHelp(): Promise<void> {
    const helpText = this.wispr.getCommandsHelpText();
    await this.speak(helpText);
  }

  // ==================== Audio Control ====================

  /**
   * Speak text using TTS (for navigation steps)
   * Sets isSpeakingNavStep to prevent Overshoot from interrupting
   */
  private async speak(text: string): Promise<void> {
    this.isSpeakingNavStep = true;
    this.callbacks?.onSpeaking(text);
    
    try {
      await this.tts.speak(text);
      // Wait a bit after speech completes
      await this.delay(300);
    } finally {
      this.isSpeakingNavStep = false;
    }
  }

  /**
   * Mute Overshoot announcements
   */
  muteOvershoot(): void {
    this.overshootMuted = true;
    this.updateState({ isOvershootMuted: true });
  }

  /**
   * Unmute Overshoot announcements
   */
  unmuteOvershoot(): void {
    this.overshootMuted = false;
    this.updateState({ isOvershootMuted: false });
  }

  // ==================== Cleanup ====================

  /**
   * Stop navigation and cleanup all services
   */
  async stopNavigation(): Promise<void> {
    console.log('[UnifiedNav] Stopping navigation');

    // Stop voice command listening
    this.wispr.stopContinuousListening();
    this.wispr.cancelRecording();

    // Stop Overshoot
    await this.overshoot.stopStreaming();

    // Stop TTS
    this.tts.stop();

    // Reset state
    this.stepsManager.reset();
    this.overshootMuted = false;
    this.lastOvershootResult = null;

    this.updateState({
      status: 'completed',
      isOvershootMuted: false,
    });

    await this.speak("Navigation ended.");

    // Return to idle after brief delay
    setTimeout(() => {
      this.updateState(this.getInitialState());
    }, 2000);
  }

  /**
   * Reset to idle state (without speaking)
   */
  reset(): void {
    this.wispr.stopContinuousListening();
    this.wispr.cancelRecording();
    this.overshoot.stopStreaming();
    this.tts.stop();
    this.stepsManager.reset();
    this.overshootMuted = false;
    this.isSpeakingNavStep = false;
    this.lastOvershootSpeechTime = 0;
    this.lastOvershootResult = null;
    this.state = this.getInitialState();
    this.callbacks?.onStateChange(this.state);
  }

  // ==================== Utility Methods ====================

  /**
   * Get video stream for camera preview
   */
  getVideoStream(): MediaStream | null {
    return this.overshoot.getMediaStream();
  }

  /**
   * Check if services are configured
   */
  checkServicesStatus(): { wispr: boolean; gemini: boolean; overshoot: boolean; tts: boolean } {
    return {
      wispr: this.wispr.hasApiKey(),
      gemini: this.gemini !== null,
      overshoot: this.overshoot.hasApiKey(),
      tts: this.tts.hasApiKey(),
    };
  }

  /**
   * Get all navigation steps (for display)
   */
  getAllSteps(): NavigationStep[] {
    return this.stepsManager.getAllSteps();
  }

  /**
   * Get formatted steps for display
   */
  getStepsForDisplay(): string {
    return this.stepsManager.formatAllStepsForDisplay();
  }

  /**
   * Quick navigation with text input (for testing)
   */
  async navigateWithText(query: string): Promise<boolean> {
    this.updateState({ status: 'requesting', userQuery: query });
    return this.requestDirections(query);
  }
}

// Export singleton instance
export default new UnifiedNavigationService();
