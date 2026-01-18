/**
 * Wispr Flow Speech-to-Text Service
 * 
 * Optimized for iOS Safari:
 * - Auto-detects supported MediaRecorder mime types
 * - Falls back to webkitSpeechRecognition when MediaRecorder isn't available
 * - Provides text input fallback as last resort
 */

const API_KEY = process.env.EXPO_PUBLIC_WISPRFLOW_API_KEY || '';
const API_URL = 'https://api.wisprflow.ai/api'; // Updated endpoint

// Supported mime types in order of preference
const MIME_TYPE_PRIORITY = [
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/wav',
];

export class WisprFlowService {
  private apiKey: string;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private supportedMimeType: string | null = null;
  private lastError: string | null = null;

  constructor() {
    this.apiKey = API_KEY.trim();
    console.log('[WisprFlow] Initialized, API key configured:', !!this.apiKey);
    this.detectSupportedMimeType();
  }

  /**
   * Detect the best supported mime type for this browser
   */
  private detectSupportedMimeType(): void {
    if (typeof MediaRecorder === 'undefined') {
      console.warn('[WisprFlow] MediaRecorder not available');
      return;
    }

    for (const mimeType of MIME_TYPE_PRIORITY) {
      try {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          this.supportedMimeType = mimeType;
          console.log('[WisprFlow] Using mime type:', mimeType);
          return;
        }
      } catch (e) {
        // Continue checking
      }
    }

    // Try without specifying mime type (browser default)
    this.supportedMimeType = '';
    console.log('[WisprFlow] Using browser default mime type');
  }

  hasApiKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Check if MediaRecorder is available
   */
  isMediaRecorderAvailable(): boolean {
    return typeof MediaRecorder !== 'undefined' && this.supportedMimeType !== null;
  }

  /**
   * Check if speech recognition is available
   */
  isSpeechRecognitionAvailable(): boolean {
    return !!(
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition
    );
  }

  /**
   * Start recording audio from microphone
   * Returns false if MediaRecorder isn't available - use fallback in that case
   */
  async startRecording(): Promise<boolean> {
    if (this.isRecording) {
      console.warn('[WisprFlow] Already recording');
      return true;
    }

    this.lastError = null;

    // Check if MediaRecorder is available
    if (!this.isMediaRecorderAvailable()) {
      this.lastError = 'MediaRecorder not supported on this device';
      console.warn('[WisprFlow]', this.lastError);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });

      // Create MediaRecorder with best available mime type
      const options: MediaRecorderOptions = {};
      if (this.supportedMimeType) {
        options.mimeType = this.supportedMimeType;
      }

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event: any) => {
        this.lastError = `Recording error: ${event.error?.message || 'Unknown'}`;
        console.error('[WisprFlow]', this.lastError);
      };

      // Request data every 250ms for smoother experience
      this.mediaRecorder.start(250);
      this.isRecording = true;
      console.log('[WisprFlow] Recording started with mime type:', this.mediaRecorder.mimeType);
      return true;
    } catch (error: any) {
      this.lastError = `Microphone access failed: ${error.message}`;
      console.error('[WisprFlow]', this.lastError);
      return false;
    }
  }

  /**
   * Stop recording and transcribe the audio
   */
  async stopRecordingAndTranscribe(): Promise<string> {
    if (!this.mediaRecorder || !this.isRecording) {
      console.warn('[WisprFlow] Not currently recording');
      return '';
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        // Use the actual mime type from the recorder
        const actualMimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: actualMimeType });
        this.isRecording = false;
        
        // Stop all tracks
        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
        
        console.log('[WisprFlow] Recording stopped, blob size:', audioBlob.size, 'type:', actualMimeType);
        
        if (audioBlob.size < 1000) {
          console.warn('[WisprFlow] Recording too short');
          resolve('');
          return;
        }

        try {
          const text = await this.transcribe(audioBlob);
          resolve(text);
        } catch (error: any) {
          this.lastError = `Transcription failed: ${error.message}`;
          console.error('[WisprFlow]', this.lastError);
          resolve('');
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * Cancel recording without transcribing
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.audioChunks = [];
      console.log('[WisprFlow] Recording cancelled');
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Use fallback input method (speech recognition or prompt)
   * Call this when startRecording() returns false
   */
  async useFallbackInput(): Promise<string | null> {
    // Try webkitSpeechRecognition first
    if (this.isSpeechRecognitionAvailable()) {
      console.log('[WisprFlow] Using browser speech recognition fallback');
      return this.browserSpeechRecognition();
    }

    // Last resort: text prompt
    console.log('[WisprFlow] Using text input fallback');
    return this.textInputFallback();
  }

  /**
   * Transcribe audio blob using WisprFlow API
   */
  private async transcribe(audioBlob: Blob): Promise<string> {
    if (!this.hasApiKey()) {
      console.warn('[WisprFlow] No API key, using browser fallback');
      // Try browser speech recognition as fallback
      return this.browserSpeechRecognition();
    }

    try {
      const formData = new FormData();
      
      // Determine file extension based on mime type
      let extension = 'webm';
      if (audioBlob.type.includes('mp4')) extension = 'mp4';
      else if (audioBlob.type.includes('ogg')) extension = 'ogg';
      else if (audioBlob.type.includes('wav')) extension = 'wav';
      
      formData.append('audio', audioBlob, `recording.${extension}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`WisprFlow API error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const result = await response.json();
      const text = result.text || result.transcription || result.transcript || '';
      console.log('[WisprFlow] Transcribed:', text);
      return text;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Transcription request timeout');
      }
      throw error;
    }
  }

  /**
   * Browser speech recognition (webkitSpeechRecognition)
   */
  private browserSpeechRecognition(): Promise<string> {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let timeoutId = setTimeout(() => {
        recognition.stop();
        resolve(''); // Return empty on timeout
      }, 10000); // 10 second timeout

      recognition.onresult = (event: any) => {
        clearTimeout(timeoutId);
        const text = event.results[0]?.[0]?.transcript || '';
        console.log('[WisprFlow] Browser recognition result:', text);
        resolve(text);
      };

      recognition.onerror = (event: any) => {
        clearTimeout(timeoutId);
        console.error('[WisprFlow] Browser recognition error:', event.error);
        // Don't reject - just return empty string so app continues
        resolve('');
      };

      recognition.onend = () => {
        clearTimeout(timeoutId);
      };

      try {
        recognition.start();
        console.log('[WisprFlow] Browser speech recognition started');
      } catch (err) {
        clearTimeout(timeoutId);
        resolve('');
      }
    });
  }

  /**
   * Text input fallback using browser prompt
   */
  private textInputFallback(): Promise<string | null> {
    return new Promise((resolve) => {
      // Use window.prompt as a simple fallback
      // Note: This is not ideal UX but provides a working fallback
      if (typeof window !== 'undefined' && window.prompt) {
        const result = window.prompt('Voice input unavailable. Type your command:', '');
        resolve(result || null);
      } else {
        resolve(null);
      }
    });
  }
}

export default new WisprFlowService();
