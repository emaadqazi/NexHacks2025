/**
 * TypeScript type definitions for ClearPath
 */

// Position in 2D space with floor information
export interface Position {
  x: number;
  y: number;
  floor: number;
  accuracy?: number; // Position accuracy in meters
}

// Landmark/Point of Interest in the building
export interface Landmark {
  id: string;
  name: string;
  type: 'room' | 'entrance' | 'exit' | 'stairs' | 'elevator' | 'restroom' | 'other';
  position: Position;
  description?: string;
  accessible?: boolean; // Whether it's wheelchair accessible
}

// Navigation path with waypoints
export interface Path {
  waypoints: Position[];
  totalDistance: number; // Total distance in meters
  estimatedTime: number; // Estimated time in seconds
  instructions?: string[]; // Turn-by-turn instructions
}

// Detected object from camera
export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  distance?: number; // Distance in meters (if available)
}

// Voice command structure
export interface VoiceCommand {
  command: 'navigate' | 'where' | 'help' | 'stop' | 'repeat' | 'unknown';
  destination?: string;
  parameters?: Record<string, any>;
  timestamp: number;
}

// Navigation instruction
export interface NavigationInstruction {
  type: 'straight' | 'left' | 'right' | 'stairs' | 'elevator' | 'arrived';
  description: string;
  distance: number; // Distance to next waypoint in meters
  direction?: number; // Direction in degrees (0-359)
}

// Floor plan structure
export interface FloorPlan {
  buildingId: string;
  buildingName: string;
  floors: Floor[];
}

export interface Floor {
  floorNumber: number;
  landmarks: Landmark[];
  connections: Connection[]; // Connections between landmarks
}

export interface Connection {
  from: string; // Landmark ID
  to: string; // Landmark ID
  distance: number; // Distance in meters
  accessible?: boolean; // Whether connection is wheelchair accessible
}
