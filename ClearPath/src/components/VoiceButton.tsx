/**
 * Voice Button Component
 * Button to trigger voice input for navigation commands
 */

import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import VoiceService from '../services/VoiceService';

interface VoiceButtonProps {
  onCommand?: (command: string) => void;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onCommand }) => {
  const [isListening, setIsListening] = useState(false);

  const handlePress = async () => {
    if (isListening) {
      await VoiceService.stopListening();
      setIsListening(false);
    } else {
      await VoiceService.startListening();
      setIsListening(true);
      // Simulate voice command for now
      setTimeout(() => {
        setIsListening(false);
      }, 3000);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, isListening && styles.buttonActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{isListening ? '🎤' : '🔊'}</Text>
      </View>
      <Text style={styles.buttonText}>
        {isListening ? 'Listening...' : 'Tap to Speak'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 200,
  },
  buttonActive: {
    backgroundColor: '#FF3B30',
  },
  iconContainer: {
    marginBottom: 5,
  },
  icon: {
    fontSize: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
