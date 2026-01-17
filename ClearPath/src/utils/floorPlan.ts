/**
 * Floor plan data and pathfinding logic
 * 
 * This file contains sample floor plan data and utility functions
 * for working with building layouts.
 */

import { FloorPlan, Landmark, Connection } from '../types';

/**
 * Sample floor plan for testing
 * This represents a simple single-floor building layout
 */
export const sampleFloorPlan: FloorPlan = {
  buildingId: 'sample-building-1',
  buildingName: 'Sample Office Building',
  floors: [
    {
      floorNumber: 1,
      landmarks: [
        {
          id: 'entrance',
          name: 'Main Entrance',
          type: 'entrance',
          position: { x: 0, y: 0, floor: 1 },
          description: 'Main entrance with automatic doors',
          accessible: true,
        },
        {
          id: 'lobby',
          name: 'Lobby',
          type: 'other',
          position: { x: 5, y: 0, floor: 1 },
          description: 'Main lobby area with reception desk',
          accessible: true,
        },
        {
          id: 'elevator',
          name: 'Elevator',
          type: 'elevator',
          position: { x: 10, y: 0, floor: 1 },
          description: 'Main elevator to all floors',
          accessible: true,
        },
        {
          id: 'restroom',
          name: 'Restroom',
          type: 'restroom',
          position: { x: 10, y: 5, floor: 1 },
          description: 'Accessible restroom',
          accessible: true,
        },
        {
          id: 'room-101',
          name: 'Conference Room 101',
          type: 'room',
          position: { x: 15, y: 0, floor: 1 },
          description: 'Large conference room',
          accessible: true,
        },
        {
          id: 'stairs',
          name: 'Stairwell',
          type: 'stairs',
          position: { x: 15, y: 5, floor: 1 },
          description: 'Emergency stairwell',
          accessible: false,
        },
        {
          id: 'exit',
          name: 'Emergency Exit',
          type: 'exit',
          position: { x: 20, y: 5, floor: 1 },
          description: 'Emergency exit door',
          accessible: true,
        },
      ],
      connections: [
        { from: 'entrance', to: 'lobby', distance: 5, accessible: true },
        { from: 'lobby', to: 'elevator', distance: 5, accessible: true },
        { from: 'elevator', to: 'restroom', distance: 5, accessible: true },
        { from: 'elevator', to: 'room-101', distance: 5, accessible: true },
        { from: 'restroom', to: 'stairs', distance: 5, accessible: false },
        { from: 'stairs', to: 'exit', distance: 5, accessible: false },
        { from: 'room-101', to: 'stairs', distance: 7, accessible: false },
      ],
    },
  ],
};

/**
 * Get landmark by ID
 * @param landmarkId Landmark ID to find
 * @returns Landmark object or null if not found
 */
export function getLandmarkById(landmarkId: string, floorPlan: FloorPlan = sampleFloorPlan): Landmark | null {
  for (const floor of floorPlan.floors) {
    const landmark = floor.landmarks.find(l => l.id === landmarkId);
    if (landmark) return landmark;
  }
  return null;
}

/**
 * Get all landmarks on a specific floor
 * @param floorNumber Floor number
 * @returns Array of landmarks on that floor
 */
export function getLandmarksByFloor(floorNumber: number, floorPlan: FloorPlan = sampleFloorPlan): Landmark[] {
  const floor = floorPlan.floors.find(f => f.floorNumber === floorNumber);
  return floor ? floor.landmarks : [];
}

/**
 * Calculate Euclidean distance between two positions
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Distance in meters
 */
export function calculateDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
): number {
  return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

/**
 * Get connections for a specific landmark
 * @param landmarkId Landmark ID
 * @returns Array of connections
 */
export function getConnectionsForLandmark(
  landmarkId: string,
  floorPlan: FloorPlan = sampleFloorPlan
): Connection[] {
  const connections: Connection[] = [];
  for (const floor of floorPlan.floors) {
    const floorConnections = floor.connections.filter(
      c => c.from === landmarkId || c.to === landmarkId
    );
    connections.push(...floorConnections);
  }
  return connections;
}
