/**
 * Navigation UI Component
 * Displays turn-by-turn navigation instructions
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationInstruction } from '../types';

interface NavigationUIProps {
  instruction?: NavigationInstruction | null;
  distanceToDestination?: number | null;
}

export const NavigationUI: React.FC<NavigationUIProps> = ({
  instruction,
  distanceToDestination,
}) => {
  const getDirectionIcon = (type: string) => {
    switch (type) {
      case 'straight':
        return '⬆️';
      case 'left':
        return '⬅️';
      case 'right':
        return '➡️';
      case 'stairs':
        return '🚶';
      case 'elevator':
        return '🛗';
      case 'arrived':
        return '🎯';
      default:
        return '📍';
    }
  };

  if (!instruction) {
    return (
      <View style={styles.container}>
        <Text style={styles.noNavigation}>
          Say "Navigate to..." to start navigation
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.instructionContainer}>
        <Text style={styles.icon}>{getDirectionIcon(instruction.type)}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.instructionText}>{instruction.description}</Text>
          {instruction.distance > 0 && (
            <Text style={styles.distanceText}>
              In {Math.round(instruction.distance)} meters
            </Text>
          )}
        </View>
      </View>
      {distanceToDestination !== null && distanceToDestination !== undefined && (
        <View style={styles.destinationInfo}>
          <Text style={styles.destinationText}>
            {Math.round(distanceToDestination)}m to destination
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    borderRadius: 15,
    margin: 20,
  },
  noNavigation: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  instructionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  distanceText: {
    color: '#ccc',
    fontSize: 16,
  },
  destinationInfo: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  destinationText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});
