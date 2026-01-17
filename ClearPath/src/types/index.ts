/**
 * Types Index
 * Central export point for all TypeScript types
 */

// Re-export service types
export type { DetectedObject, DetectionResponse, StreamInferenceResult } from '../services/OvershootService';

// Navigation types (if needed in future)
export interface Position {
  x: number;
  y: number;
  floor?: number;
}

export interface Landmark {
  id: string;
  name: string;
  position: Position;
  type: 'room' | 'entrance' | 'exit' | 'elevator' | 'stairs' | 'restroom' | 'other';
}

export interface NavigationInstruction {
  action: 'forward' | 'turn_left' | 'turn_right' | 'stop' | 'arrived';
  distance?: number;
  landmark?: string;
  message: string;
}
