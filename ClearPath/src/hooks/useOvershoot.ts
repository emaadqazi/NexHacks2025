/**
 * useOvershoot Hook
 * React hook for managing Overshoot SDK RealtimeVision
 * Handles camera streaming and real-time object detection
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { RealtimeVision } from '@overshoot/sdk';

// Get API credentials from environment (for web, use window or import)
const API_URL = process.env.EXPO_PUBLIC_OVERSHOOT_API_URL || 'https://cluster1.overshoot.ai/api/v0.2';
const API_KEY = process.env.EXPO_PUBLIC_OVERSHOOT_API_KEY || '';

export interface DetectionResult {
  id: string;
  result: string;
  latencyMs: number;
  ok: boolean;
  error: string | null;
}

interface UseOvershootOptions {
  apiKey?: string;
  apiUrl?: string;
  prompt?: string;
  onResult?: (result: DetectionResult) => void;
  onError?: (error: Error) => void;
}

interface UseOvershootReturn {
  isStreaming: boolean;
  isLoading: boolean;
  lastResult: DetectionResult | null;
  error: string | null;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  updatePrompt: (prompt: string) => Promise<void>;
  mediaStream: MediaStream | null;
}

export function useOvershoot(options: UseOvershootOptions = {}): UseOvershootReturn {
  const {
    apiKey = API_KEY,
    apiUrl = API_URL,
    prompt = 'Detect indoor navigation objects: doors, walls, signs, stairs, elevators, trash cans, people, obstacles. For each object, describe its position (left, center, right) and distance (near, medium, far).',
    onResult,
    onError,
  } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const visionRef = useRef<RealtimeVision | null>(null);

  // Start streaming
  const startStreaming = useCallback(async () => {
    if (isStreaming || !apiKey) {
      if (!apiKey) {
        setError('API key not configured. Set EXPO_PUBLIC_OVERSHOOT_API_KEY in your environment.');
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useOvershoot] Starting RealtimeVision...');
      console.log('[useOvershoot] API URL:', apiUrl);
      console.log('[useOvershoot] Has API Key:', !!apiKey);

      visionRef.current = new RealtimeVision({
        apiUrl,
        apiKey,
        prompt,
        source: {
          type: 'camera',
          cameraFacing: 'environment', // Back camera
        },
        onResult: (result) => {
          console.log('[useOvershoot] Result received:', result);
          const detectionResult: DetectionResult = {
            id: result.id,
            result: result.result,
            latencyMs: result.total_latency_ms,
            ok: result.ok,
            error: result.error,
          };
          setLastResult(detectionResult);
          onResult?.(detectionResult);
        },
        onError: (err) => {
          console.error('[useOvershoot] Error:', err);
          setError(err.message);
          onError?.(err);
        },
      });

      await visionRef.current.start();
      
      // Get the media stream for display
      const stream = visionRef.current.getMediaStream();
      setMediaStream(stream);
      
      setIsStreaming(true);
      console.log('[useOvershoot] Streaming started successfully');
    } catch (err: any) {
      console.error('[useOvershoot] Failed to start:', err);
      setError(err.message || 'Failed to start streaming');
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, apiUrl, prompt, isStreaming, onResult, onError]);

  // Stop streaming
  const stopStreaming = useCallback(async () => {
    if (!visionRef.current) return;

    try {
      await visionRef.current.stop();
      visionRef.current = null;
      setIsStreaming(false);
      setMediaStream(null);
      console.log('[useOvershoot] Streaming stopped');
    } catch (err: any) {
      console.error('[useOvershoot] Error stopping:', err);
    }
  }, []);

  // Update prompt
  const updatePrompt = useCallback(async (newPrompt: string) => {
    if (!visionRef.current || !isStreaming) {
      console.warn('[useOvershoot] Cannot update prompt - not streaming');
      return;
    }

    try {
      await visionRef.current.updatePrompt(newPrompt);
      console.log('[useOvershoot] Prompt updated');
    } catch (err: any) {
      console.error('[useOvershoot] Error updating prompt:', err);
      setError(err.message);
    }
  }, [isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (visionRef.current) {
        visionRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return {
    isStreaming,
    isLoading,
    lastResult,
    error,
    startStreaming,
    stopStreaming,
    updatePrompt,
    mediaStream,
  };
}

export default useOvershoot;
