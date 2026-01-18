/**
 * Navigation Workflow Service
 * 
 * Orchestrates the complete navigation flow:
 * 1. WisprFlow: Voice input → text transcription
 * 2. Gemini API: User query → navigation steps
 * 3. Overshoot: Real-time vision with navigation context
 * 
 * Usage:
 *   const workflow = new NavigationWorkflowService();
 *   await workflow.startNavigationSession(onUpdate);
 */

import WisprFlowService from './WisprFlow';
import { OvershootService, DetectionResponse } from './OvershootService';

// Type definitions for Gemini service
interface NavigationResult {
  timestamp: string;
  query: string;
  floor: string;
  verbosity: 'minimal' | 'moderate' | 'detailed';
  floorPlan: string;
  prompt: string;
  response: string;
}

// Conditionally import Gemini service (Node.js only)
let GeminiNavigationService: any = null;
let geminiImportError: any = null;

try {
  const geminiModule = require('./geminiPathfinding');
  GeminiNavigationService = geminiModule.GeminiNavigationService;
} catch (error) {
  geminiImportError = error;
  console.warn('[NavigationWorkflow] Gemini service unavailable in browser environment');
}

export type { NavigationResult };

export interface NavigationState {
  status: 'idle' | 'listening' | 'verifying' | 'loading' | 'navigating' | 'error';
  userQuery?: string;
  navigationSteps?: string;
  currentFloor?: string;
  error?: string;
}

export interface WorkflowCallbacks {
  onStateChange: (state: NavigationState) => void;
  onTranscriptionReady: (query: string) => void;
  onNavigationReady: (steps: string) => void;
  onVisionUpdate: (result: DetectionResponse) => void;
  onError: (error: string) => void;
}

/**
 * Navigation Workflow Service
 * Coordinates voice input, pathfinding, and real-time vision assistance
 */
export class NavigationWorkflowService {
  private wisprFlow: typeof WisprFlowService;
  private overshoot: OvershootService;
  private gemini: any | null = null;
  private state: NavigationState = { status: 'idle' };
  private callbacks: WorkflowCallbacks | null = null;
  private navigationContext: string = '';

  constructor() {
    this.wisprFlow = WisprFlowService;
    this.overshoot = new OvershootService();
    
    // Initialize Gemini service (will throw if API key not configured or if import failed)
    if (GeminiNavigationService && !geminiImportError) {
      try {
        this.gemini = new GeminiNavigationService();
      } catch (error) {
        console.warn('[NavigationWorkflow] Gemini not initialized:', error);
      }
    } else {
      console.warn('[NavigationWorkflow] Gemini service unavailable in browser - use Node.js for pathfinding features');
    }
  }

  /**
   * Start the navigation workflow
   * 1. Begin recording user's voice query
   */
  async startListening(callbacks: WorkflowCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.updateState({ status: 'listening' });

    const started = await this.wisprFlow.startRecording();
    if (!started) {
      this.updateState({ status: 'error', error: 'Failed to start recording' });
      callbacks.onError('Failed to start recording. Please check microphone permissions.');
      return false;
    }

    console.log('[NavigationWorkflow] Listening for user query...');
    return true;
  }

  /**
   * Stop listening and transcribe - returns transcription for user verification
   * Does NOT automatically proceed to navigation
   */
  async stopListeningAndVerify(): Promise<string | null> {
    if (!this.callbacks) {
      console.error('[NavigationWorkflow] No callbacks registered');
      return null;
    }

    console.log('[NavigationWorkflow] Transcribing voice input...');

    const userQuery = await this.wisprFlow.stopRecordingAndTranscribe();
    
    if (!userQuery || userQuery.trim().length === 0) {
      this.updateState({ status: 'error', error: 'Could not understand speech' });
      this.callbacks.onError('Could not understand your request. Please try again.');
      return null;
    }

    console.log('[NavigationWorkflow] User query:', userQuery);
    this.updateState({ status: 'verifying', userQuery });
    this.callbacks.onTranscriptionReady(userQuery);
    
    return userQuery;
  }

  /**
   * User confirmed transcription - now proceed with navigation
   * Calls Gemini API, then starts Overshoot with context
   */
  async confirmAndNavigate(userQuery: string): Promise<void> {
    if (!this.callbacks) {
      console.error('[NavigationWorkflow] No callbacks registered');
      return;
    }

    // Update state to loading while waiting for Gemini
    this.updateState({ status: 'loading', userQuery });
    console.log('[NavigationWorkflow] Getting navigation from Gemini...');

    try {
      const navigationResult = await this.getNavigationSteps(userQuery);
      
      if (!navigationResult) {
        this.updateState({ status: 'error', error: 'Navigation service unavailable' });
        this.callbacks.onError('Navigation service is not available. Please check API configuration.');
        return;
      }

      console.log('[NavigationWorkflow] Navigation steps received');
      this.navigationContext = navigationResult.response;
      
      this.updateState({
        status: 'navigating',
        userQuery,
        navigationSteps: navigationResult.response,
        currentFloor: navigationResult.floor,
      });

      // Notify that navigation is ready (UI should show directions)
      this.callbacks.onNavigationReady(navigationResult.response);

      // Start Overshoot with navigation context - camera activates now
      await this.startVisionWithContext(navigationResult);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[NavigationWorkflow] Error:', errorMsg);
      this.updateState({ status: 'error', error: errorMsg });
      this.callbacks.onError(`Navigation error: ${errorMsg}`);
    }
  }

  /**
   * Cancel verification and return to idle state
   */
  cancelVerification(): void {
    this.wisprFlow.cancelRecording();
    this.updateState({ status: 'idle', userQuery: undefined });
  }

  /**
   * Get navigation steps from Gemini API
   */
  private async getNavigationSteps(userQuery: string): Promise<NavigationResult | null> {
    if (!this.gemini) {
      console.error('[NavigationWorkflow] Gemini service not initialized');
      return null;
    }

    try {
      const result = await this.gemini.navigate(userQuery, false); // Don't save response file
      return result;
    } catch (error) {
      console.error('[NavigationWorkflow] Gemini error:', error);
      throw error;
    }
  }

  /**
   * Start Overshoot vision streaming with navigation context
   * Injects the Gemini navigation steps into the prompt
   */
  private async startVisionWithContext(navResult: NavigationResult): Promise<void> {
    if (!this.callbacks) return;

    // Build an enhanced prompt with navigation context
    const enhancedPrompt = this.buildNavigationAwarePrompt(navResult);

    console.log('[NavigationWorkflow] Starting vision with navigation context...');

    const started = await this.overshoot.startStreaming(
      (result) => {
        this.callbacks?.onVisionUpdate(result);
      },
      enhancedPrompt
    );

    if (!started) {
      console.warn('[NavigationWorkflow] Vision streaming failed to start');
      // Don't error out - navigation steps are still available
    }
  }

  /**
   * Build an Overshoot prompt enhanced with navigation context
   */
  private buildNavigationAwarePrompt(navResult: NavigationResult): string {
    const prompt = `You are a real-time navigation assistant for a visually impaired person navigating indoors.

CURRENT NAVIGATION CONTEXT:
The user is on the ${navResult.floor} floor.
Their query: "${navResult.query}"

NAVIGATION STEPS TO FOLLOW:
${navResult.response}

YOUR TASK:
Based on the camera feed, help the user follow these navigation steps by:

1. CONFIRMING PROGRESS: Tell them when they've completed a step
   - "Good, I see the door ahead - that's your next turn point"
   - "You're passing the fitness center on your left"

2. OBSTACLE WARNINGS: Alert them to immediate hazards
   - "Person approaching from your right"
   - "Chair obstacle 3 steps ahead on your left"

3. LANDMARK CONFIRMATION: Help them know they're on track
   - "I can see the conference room sign ahead"
   - "The elevator is visible on your right"

4. COURSE CORRECTION: Guide them if they veer off
   - "Turn slightly left to stay on path"
   - "You've passed the turn, turn around"

COMMUNICATION STYLE:
- Keep responses to 1-2 sentences maximum
- Be direct and clear
- Use clock positions or left/right/straight
- Estimate distances in steps when possible
- Only speak when there's actionable information

DO NOT:
- Describe the general scene
- Repeat the navigation steps unless asked
- Give information that isn't immediately relevant
- Use unnecessary pleasantries`;

    return prompt;
  }

  /**
   * Update the prompt during navigation (e.g., when user completes a step)
   */
  async updateNavigationContext(update: string): Promise<void> {
    if (!this.overshoot.isActive()) return;

    const updatedPrompt = `${this.navigationContext}\n\nUPDATE: ${update}`;
    await this.overshoot.updatePrompt(updatedPrompt);
  }

  /**
   * Stop the entire navigation session
   */
  async stopNavigation(): Promise<void> {
    console.log('[NavigationWorkflow] Stopping navigation session');
    
    // Cancel any ongoing recording
    this.wisprFlow.cancelRecording();
    
    // Stop vision streaming
    await this.overshoot.stopStreaming();
    
    this.updateState({ status: 'idle' });
    this.callbacks = null;
    this.navigationContext = '';
  }

  /**
   * Get current navigation state
   */
  getState(): NavigationState {
    return { ...this.state };
  }

  /**
   * Check if all services are configured
   */
  checkServicesStatus(): { wispr: boolean; gemini: boolean; overshoot: boolean } {
    return {
      wispr: this.wisprFlow.hasApiKey(),
      gemini: this.gemini !== null,
      overshoot: this.overshoot.hasApiKey(),
    };
  }

  /**
   * Update internal state and notify callbacks
   */
  private updateState(updates: Partial<NavigationState>): void {
    this.state = { ...this.state, ...updates };
    this.callbacks?.onStateChange(this.state);
  }

  /**
   * Get the Overshoot media stream for video preview
   */
  getVideoStream(): MediaStream | null {
    return this.overshoot.getMediaStream();
  }

  /**
   * Quick navigation without voice (for testing or text input)
   */
  async navigateWithText(query: string, callbacks: WorkflowCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.updateState({ status: 'loading', userQuery: query });

    try {
      const navigationResult = await this.getNavigationSteps(query);
      
      if (!navigationResult) {
        this.updateState({ status: 'error', error: 'Navigation service unavailable' });
        callbacks.onError('Navigation service is not available.');
        return;
      }

      this.navigationContext = navigationResult.response;
      
      this.updateState({
        status: 'navigating',
        userQuery: query,
        navigationSteps: navigationResult.response,
        currentFloor: navigationResult.floor,
      });

      callbacks.onNavigationReady(navigationResult.response);
      await this.startVisionWithContext(navigationResult);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.updateState({ status: 'error', error: errorMsg });
      callbacks.onError(`Navigation error: ${errorMsg}`);
    }
  }
}

// Export singleton for convenience
export default new NavigationWorkflowService();
