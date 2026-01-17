/**
 * Web Camera View Component
 * Uses browser getUserMedia API for camera access
 * Displays video preview in an HTML5 video element
 */

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface WebCameraViewProps {
  style?: any;
  onCameraReady?: () => void;
  onCameraError?: (error: string) => void;
}

export interface WebCameraViewRef {
  getMediaStream: () => MediaStream | null;
  stopCamera: () => void;
}

export const WebCameraView = forwardRef<WebCameraViewRef, WebCameraViewProps>(
  ({ style, onCameraReady, onCameraError }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      getMediaStream: () => mediaStream,
      stopCamera: () => {
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          setMediaStream(null);
        }
      },
    }));

    useEffect(() => {
      // Only run in browser environment
      if (Platform.OS !== 'web') {
        setError('WebCameraView only works in web browser');
        return;
      }

      const startCamera = async () => {
        try {
          // Check if getUserMedia is available
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API not available. Make sure you are using HTTPS.');
          }

          console.log('[WebCameraView] Requesting camera access...');

          // Request camera access (back camera preferred for mobile)
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' }, // Back camera on mobile
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });

          console.log('[WebCameraView] Camera access granted');
          setMediaStream(stream);

          // Attach stream to video element
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsReady(true);
            onCameraReady?.();
          }
        } catch (err: any) {
          console.error('[WebCameraView] Camera error:', err);
          const errorMessage = err.message || 'Failed to access camera';
          setError(errorMessage);
          onCameraError?.(errorMessage);
        }
      };

      startCamera();

      // Cleanup on unmount
      return () => {
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
        }
      };
    }, []);

    // Non-web fallback
    if (Platform.OS !== 'web') {
      return (
        <View style={[styles.container, style]}>
          <Text style={styles.errorText}>Camera only available in web browser</Text>
        </View>
      );
    }

    // Error state
    if (error) {
      return (
        <View style={[styles.container, style]}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.hintText}>
            Make sure camera permissions are granted and you're using HTTPS
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // Mirror for selfie view
          }}
        />
        {!isReady && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Starting camera...</Text>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  hintText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
});

export default WebCameraView;
