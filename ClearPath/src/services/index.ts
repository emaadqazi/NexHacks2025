/**
 * Services Index
 * Central export point for all services
 */

export { default as OvershootService, OvershootService as OvershootServiceClass } from './OvershootService';
export type { DetectedObject, DetectionResponse, StreamInferenceResult } from './OvershootService';

export { default as ElevenLabsService, ElevenLabsService as ElevenLabsServiceClass } from './ElevenLabsTTS';
export { default as WisprFlowService, WisprFlowService as WisprFlowServiceClass } from './WisprFlow';
