/**
 * Services Index
 * Central export point for all services
 */

// Overshoot - Real-time vision/object detection
export { default as OvershootService, OvershootService as OvershootServiceClass } from './OvershootService';
export type { DetectedObject, DetectionResponse, StreamInferenceResult } from './OvershootService';

// WisprFlow - Speech-to-text with voice command support
export { default as WisprFlowService, WisprFlowService as WisprFlowServiceClass } from './WisprFlow';
export type { VoiceCommand, CommandCallback } from './WisprFlow';

// Gemini Navigation - Pathfinding with floor plans
export { GeminiNavigationService } from './geminiPathfinding';
export type { NavigationResult, Verbosity } from './geminiPathfinding';

// Navigation Steps Manager - Parse and manage step-by-step instructions
export { default as NavigationStepsManager, NavigationStepsManager as NavigationStepsManagerClass } from './NavigationStepsManager';
export type { NavigationStep, ParsedNavigation } from './NavigationStepsManager';

// Unified Navigation Service - Main orchestration service
export { default as UnifiedNavigationService, UnifiedNavigationService as UnifiedNavigationServiceClass } from './UnifiedNavigationService';
export type { NavigationStatus, NavigationState, UnifiedNavCallbacks } from './UnifiedNavigationService';

// ElevenLabs TTS - Text-to-speech for voice output
export { default as ElevenLabsTTS, ElevenLabsService } from './ElevenLabsTTS';

// Legacy exports (deprecated - use UnifiedNavigationService instead)
export { default as NavigationWorkflow, NavigationWorkflowService } from './NavigationWorkflow';
export type { WorkflowCallbacks } from './NavigationWorkflow';
