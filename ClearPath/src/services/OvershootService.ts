/**
 * Overshoot Service for Web
 * Uses the official @overshoot/sdk RealtimeVision for browser-based object detection
 * 
 * This service is designed for web browsers only.
 * It uses WebRTC to stream video to Overshoot's AI servers.
 * 
 * Setup:
 * 1. Set EXPO_PUBLIC_OVERSHOOT_API_KEY in your environment
 * 2. Set EXPO_PUBLIC_OVERSHOOT_API_URL (defaults to https://cluster1.overshoot.ai/api/v0.2)
 * 
 * Docs: https://docs.overshoot.ai/getting-started
 */

import { RealtimeVision } from '@overshoot/sdk';
import { traceVisionResult } from './phoenix';

// Configuration from environment
const API_URL = process.env.EXPO_PUBLIC_OVERSHOOT_API_URL || 'https://cluster1.overshoot.ai/api/v0.2';
const API_KEY = process.env.EXPO_PUBLIC_OVERSHOOT_API_KEY || '';

// Types
export interface DetectedObject {
  label: string;
  confidence: number;
  position: 'left' | 'center' | 'right';
  distance: 'near' | 'medium' | 'far';
}

export interface DetectionResponse {
  success: boolean;
  objects: DetectedObject[];
  processingTime: number;
  rawResult?: string;
  error?: string;
}

export interface StreamInferenceResult {
  id: string;
  stream_id: string;
  result: string;
  inference_latency_ms: number;
  total_latency_ms: number;
  ok: boolean;
  error: string | null;
}

type ResultCallback = (result: DetectionResponse) => void;

/**
 * Overshoot Service Class
 * Manages RealtimeVision SDK for continuous object detection
 */
export class OvershootService {
  private vision: RealtimeVision | null = null;
  private isStreaming: boolean = false;
  private onResultCallback: ResultCallback | null = null;
  private lastResult: DetectionResponse | null = null;
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey?: string, apiUrl?: string) {
    // Clean the API key - remove quotes, trim whitespace
    const rawKey = apiKey || API_KEY;
    this.apiKey = rawKey.trim().replace(/^["']|["']$/g, ''); // Remove surrounding quotes
    this.apiUrl = (apiUrl || API_URL).trim();

    // Debug logging for API key configuration
    console.log('[OvershootService] ====== INITIALIZATION ======');
    console.log('[OvershootService] API URL:', this.apiUrl);
    console.log('[OvershootService] Raw key from env:', 
      process.env.EXPO_PUBLIC_OVERSHOOT_API_KEY 
        ? `"${process.env.EXPO_PUBLIC_OVERSHOOT_API_KEY.substring(0, 12)}..." (len: ${process.env.EXPO_PUBLIC_OVERSHOOT_API_KEY.length})` 
        : 'UNDEFINED/EMPTY');
    console.log('[OvershootService] Cleaned key:', 
      this.apiKey ? `"${this.apiKey.substring(0, 12)}..." (len: ${this.apiKey.length})` : 'EMPTY');
    console.log('[OvershootService] Key starts with:', this.apiKey.substring(0, 3));
    console.log('[OvershootService] Key ends with:', this.apiKey.substring(this.apiKey.length - 3));
    console.log('[OvershootService] ============================');
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  /**
   * Start real-time vision streaming
   * The SDK handles camera access and WebRTC streaming
   */
  async startStreaming(onResult: ResultCallback, prompt?: string): Promise<boolean> {
    if (!this.hasApiKey()) {
      console.error('[OvershootService] API key not configured');
      onResult({
        success: false,
        objects: [],
        processingTime: 0,
        error: 'API key not configured. Set EXPO_PUBLIC_OVERSHOOT_API_KEY in your environment.',
      });
      return false;
    }

    if (this.isStreaming) {
      console.warn('[OvershootService] Already streaming');
      return true;
    }

    this.onResultCallback = onResult;

    // Simple navigation prompt
    const defaultPrompt = prompt || `You are a navigation assistant for a visually impaired person.
    Give brief, clear directions in 1-2 sentences max. Focus on:
    - Obstacles or hazards ahead. For these, give specifically a WARNING message: Object head. Keep simple.
    - Doors, turns, intersections, and especially signs for restrooms, exits, elevators.
    - Distance estimates (steps or feet)
    Example: "Clear path ahead. Door on your left in 5 steps."
    Do NOT describe the scene. Only give actionable navigation instructions.`;

    // Debug counter for tracking results
    let resultCount = 0;

    try {
      console.log('[OvershootService] ====== STARTING STREAM ======');
      console.log('[OvershootService] API URL:', this.apiUrl);
      console.log('[OvershootService] API Key (first 8):', this.apiKey.substring(0, 8) + '...');
      console.log('[OvershootService] Prompt:', defaultPrompt);
      console.log('[OvershootService] Creating RealtimeVision instance...');

      this.vision = new RealtimeVision({
        apiUrl: this.apiUrl,
        apiKey: this.apiKey,
        prompt: defaultPrompt,
        source: {
          type: 'camera',
          cameraFacing: 'environment', // Use back camera on mobile
        },
        onResult: (result) => {
          resultCount++;
          console.log(`[OvershootService] ===== RESULT #${resultCount} =====`);
          console.log('[OvershootService] Raw result:', JSON.stringify(result, null, 2));
          console.log('[OvershootService] Result text:', result?.result);
          console.log('[OvershootService] Latency:', result?.total_latency_ms, 'ms');
          console.log('[OvershootService] OK:', result?.ok);
          console.log('[OvershootService] Error:', result?.error);
          
          const processed = this.processResult(result);
          console.log('[OvershootService] Processed result:', JSON.stringify(processed, null, 2));

          traceVisionResult('default', {
            success: processed.success,
            rawResult: processed.rawResult,
            processingTime: processed.processingTime,
            error: processed.error,
          });
          
          this.lastResult = processed;
          this.onResultCallback?.(processed);
        },
        onError: (error) => {
          const errorMsg = error?.message || '';
          console.error('[OvershootService] Stream error:', errorMsg);
          
          // Ignore keepalive/stream_not_found errors - these are transient WebRTC connection issues
          if (errorMsg.includes('stream_not_found') || errorMsg.includes('keepalive') || errorMsg.includes('Keepalive')) {
            console.log('[OvershootService] Ignoring transient keepalive error');
            return; // Don't show this error to user
          }
          
          // Only report real errors to the UI
          this.onResultCallback?.({
            success: false,
            objects: [],
            processingTime: 0,
            error: errorMsg,
          });
        },
      });

      console.log('[OvershootService] RealtimeVision created, calling start()...');
      await this.vision.start();
      this.isStreaming = true;
      console.log('[OvershootService] ✅ Streaming started successfully!');
      console.log('[OvershootService] Waiting for results from Overshoot API...');
      return true;

    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      console.error('[OvershootService] Failed to start:', errorMsg);
      console.error('[OvershootService] Error name:', error?.name);
      console.error('[OvershootService] Error stack:', error?.stack);
      console.error('[OvershootService] Full error object:', JSON.stringify(error, null, 2));
      
      onResult({
        success: false,
        objects: [],
        processingTime: 0,
        error: `SDK Error: ${errorMsg}`,
      });
      return false;
    }
  }

  /**
   * Stop streaming
   */
  async stopStreaming(): Promise<void> {
    if (!this.vision) return;

    try {
      await this.vision.stop();
      console.log('[OvershootService] Streaming stopped');
    } catch (error) {
      console.error('[OvershootService] Error stopping:', error);
    }

    this.vision = null;
    this.isStreaming = false;
    this.onResultCallback = null;
  }

  /**
   * Check if streaming is active
   */
  isActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Get the media stream (for displaying video preview)
   */
  getMediaStream(): MediaStream | null {
    return this.vision?.getMediaStream() || null;
  }

  /**
   * Get last detection result
   */
  getLastResult(): DetectionResponse | null {
    return this.lastResult;
  }

  /**
   * Update the detection prompt
   */
  async updatePrompt(prompt: string): Promise<void> {
    if (!this.vision || !this.isStreaming) {
      console.warn('[OvershootService] Cannot update prompt - not streaming');
      return;
    }

    try {
      await this.vision.updatePrompt(prompt);
      console.log('[OvershootService] Prompt updated');
    } catch (error) {
      console.error('[OvershootService] Error updating prompt:', error);
    }
  }

  /**
   * Process SDK result into our format
   */
  private processResult(result: any): DetectionResponse {
    if (!result.ok || result.error) {
      return {
        success: false,
        objects: [],
        processingTime: result.total_latency_ms || 0,
        error: result.error || 'Detection failed',
      };
    }

    const objects = this.parseTextResponse(result.result || '');

    return {
      success: true,
      objects,
      processingTime: result.total_latency_ms || 0,
      rawResult: result.result,
    };
  }

  /**
   * Parse text response into structured objects
   */
  private parseTextResponse(text: string): DetectedObject[] {
    if (!text || typeof text !== 'string') return [];

    const objectPatterns = [
      { pattern: /door/i, label: 'door' },
      { pattern: /wall/i, label: 'wall' },
      { pattern: /exit\s*sign|exit/i, label: 'exit sign' },
      { pattern: /washroom|restroom|bathroom|toilet/i, label: 'washroom' },
      { pattern: /stair|stairs|stairway/i, label: 'stairs' },
      { pattern: /elevator|lift/i, label: 'elevator' },
      { pattern: /trash|bin|garbage/i, label: 'trash can' },
      { pattern: /person|people|someone/i, label: 'person' },
      { pattern: /chair/i, label: 'chair' },
      { pattern: /table|desk/i, label: 'table' },
      { pattern: /window/i, label: 'window' },
      { pattern: /sign/i, label: 'sign' },
      { pattern: /hallway|corridor/i, label: 'hallway' },
    ];

    const objects: DetectedObject[] = [];

    for (const { pattern, label } of objectPatterns) {
      if (pattern.test(text)) {
        let position: 'left' | 'center' | 'right' = 'center';
        if (/left/i.test(text)) position = 'left';
        else if (/right/i.test(text)) position = 'right';

        let distance: 'near' | 'medium' | 'far' = 'medium';
        if (/near|close|nearby/i.test(text)) distance = 'near';
        else if (/far|distant/i.test(text)) distance = 'far';

        objects.push({ label, confidence: 0.85, position, distance });
      }
    }

    return objects;
  }

  /**
   * Format results for voice announcement
   */
  formatResultsForVoice(results: DetectionResponse): string {
    if (!results.success) {
      return results.error || 'Detection failed.';
    }

    if (results.rawResult) {
      // Return the raw AI response for more natural speech
      return results.rawResult.substring(0, 300);
    }

    if (results.objects.length === 0) {
      return 'No objects detected nearby.';
    }

    const sorted = [...results.objects].sort((a, b) => {
      const distOrder = { near: 0, medium: 1, far: 2 };
      return distOrder[a.distance] - distOrder[b.distance];
    });

    const descriptions = sorted.slice(0, 3).map((obj) => {
      const posText = obj.position === 'center' ? 'ahead' : `on your ${obj.position}`;
      const distText = obj.distance === 'near' ? 'close' : obj.distance === 'far' ? 'in the distance' : '';
      return `${obj.label} ${posText}${distText ? ', ' + distText : ''}`;
    });

    return `Detected: ${descriptions.join('. ')}.`;
  }

  /**
   * Format results for console logging
   */
  formatResultsForLog(results: DetectionResponse): string {
    if (!results.success) {
      return `Detection failed: ${results.error}`;
    }

    let output = `\n${'='.repeat(40)}\n`;
    output += `   OVERSHOOT DETECTION RESULTS\n`;
    output += `${'='.repeat(40)}\n`;
    output += `Processing time: ${results.processingTime}ms\n`;
    output += `Objects detected: ${results.objects.length}\n`;

    if (results.rawResult) {
      output += `\nRaw response:\n${results.rawResult.substring(0, 300)}${results.rawResult.length > 300 ? '...' : ''}\n`;
    }

    if (results.objects.length > 0) {
      output += '\nParsed objects:\n';
      results.objects.forEach((obj, i) => {
        output += `${i + 1}. ${obj.label} - ${obj.position}, ${obj.distance}\n`;
      });
    }

    output += `${'='.repeat(40)}\n`;
    return output;
  }
}

// Export singleton instance
export default new OvershootService();
