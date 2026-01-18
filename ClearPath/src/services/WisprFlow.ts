/**
 * Wispr Flow Speech-to-Text Service
 * Converts user voice commands to text for navigation requests
 */

const API_KEY = process.env.EXPO_PUBLIC_WISPR_API_KEY || '';
const API_URL = 'https://api.wisprflow.ai/api'; // REST endpoint

export class WisprFlowService {
  private apiKey: string;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;

  constructor() {
    this.apiKey = API_KEY.trim();
    console.log('[WisprFlow] Initialized, API key configured:', !!this.apiKey);
  }

  hasApiKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Start recording audio from microphone
   */
  async startRecording(): Promise<boolean> {
    if (this.isRecording) {
      console.warn('[WisprFlow] Already recording');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log('[WisprFlow] Recording started');
      return true;
    } catch (error) {
      console.error('[WisprFlow] Failed to start recording:', error);
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
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.isRecording = false;
        
        // Stop all tracks
        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
        
        console.log('[WisprFlow] Recording stopped, transcribing...');
        
        try {
          const text = await this.transcribe(audioBlob);
          resolve(text);
        } catch (error) {
          console.error('[WisprFlow] Transcription error:', error);
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
   * Transcribe audio blob using WisprFlow API
   */
  private async transcribe(audioBlob: Blob): Promise<string> {
    if (!this.hasApiKey()) {
      console.error('[WisprFlow] API key not configured');
      // Fallback to browser speech recognition if available
      return this.browserSpeechFallback();
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error("WisprFlow API error (" + response.status + "): " + errorText);
      }

      const result = await response.json();
      const text = result.text || result.transcription || result.transcript || '';
      console.log('[WisprFlow] Transcribed:', text);
      return text;
    } catch (error) {
      console.error('[WisprFlow] Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Fallback to browser's built-in speech recognition
   */
  private browserSpeechFallback(): Promise<string> {
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

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        resolve(text);
      };

      recognition.onerror = (event: any) => {
        reject(new Error(event.error));
      };

      recognition.start();
    });
  }
}

export default new WisprFlowService();