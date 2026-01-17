/**
 * ClearPath - Indoor Navigation for Blind Users
 * Main App Entry Point
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { MappingScreen } from './src/screens/MappingScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Mapping" component={MappingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
