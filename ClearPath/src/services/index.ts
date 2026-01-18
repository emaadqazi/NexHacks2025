/**
 * Services Index
 * Central export point for all services
 */

// Overshoot - Real-time vision/object detection
export { default as OvershootService, OvershootService as OvershootServiceClass } from './OvershootService';
export type { DetectedObject, DetectionResponse, StreamInferenceResult } from './OvershootService';

// WisprFlow - Speech-to-text
export { default as WisprFlowService, WisprFlowService as WisprFlowServiceClass } from './WisprFlow';

// Gemini Navigation - Pathfinding with floor plans
export { GeminiNavigationService, NavigationAssistant } from './geminiPathfinding';
export type { NavigationResult, Verbosity } from './geminiPathfinding';

// Navigation Workflow - Orchestrates the complete navigation flow
export { default as NavigationWorkflow, NavigationWorkflowService } from './NavigationWorkflow';
export type { NavigationState, WorkflowCallbacks } from './NavigationWorkflow';

// ElevenLabs TTS - Text-to-speech for voice output
export { default as ElevenLabsTTS } from './ElevenLabsTTS';
