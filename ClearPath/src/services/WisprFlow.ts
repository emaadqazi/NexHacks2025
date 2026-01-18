/**
 * Speech-to-Text Service using Web Speech API
 * Real-time speech recognition for navigation commands
 */

export class WisprFlowService {
  private recognition: any = null;
  private isRecording: boolean = false;
  private finalTranscript: string = '';
  private resolvePromise: ((text: string) => void) | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('[WisprFlow] Web Speech API not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = true; // Keep listening
    this.recognition.interimResults = true; // Show partial results
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('[WisprFlow] Speech recognition started');
      this.isRecording = true;
      this.finalTranscript = '';
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          this.finalTranscript += result[0].transcript + ' ';
          console.log('[WisprFlow] Final:', result[0].transcript);
        } else {
          interimTranscript += result[0].transcript;
          console.log('[WisprFlow] Interim:', interimTranscript);
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('[WisprFlow] Recognition error:', event.error);
      
      // Don't fail on no-speech - user might just be quiet
      if (event.error === 'no-speech') {
        console.log('[WisprFlow] No speech detected, but continuing...');
        return;
      }
      
      this.isRecording = false;
      if (this.resolvePromise) {
        this.resolvePromise(this.finalTranscript.trim());
        this.resolvePromise = null;
      }
    };

    this.recognition.onend = () => {
      console.log('[WisprFlow] Recognition ended, transcript:', this.finalTranscript);
      this.isRecording = false;
      
      if (this.resolvePromise) {
        this.resolvePromise(this.finalTranscript.trim());
        this.resolvePromise = null;
      }
    };

    console.log('[WisprFlow] Web Speech API initialized successfully');
  }

  hasApiKey(): boolean {
    // Web Speech API doesn't need an API key
    return this.recognition !== null;
  }

  /**
   * Start listening for speech
   */
  async startRecording(): Promise<boolean> {
    if (!this.recognition) {
      console.error('[WisprFlow] Speech recognition not available');
      return false;
    }

    if (this.isRecording) {
      console.warn('[WisprFlow] Already recording');
      return true;
    }

    try {
      // Reset state
      this.finalTranscript = '';
      this.resolvePromise = null;
      
      // Start recognition
      this.recognition.start();
      return true;
    } catch (error: any) {
      // Handle "already started" error gracefully
      if (error.message?.includes('already started')) {
        console.log('[WisprFlow] Recognition already running');
        this.isRecording = true;
        return true;
      }
      console.error('[WisprFlow] Failed to start:', error);
      return false;
    }
  }

  /**
   * Stop listening and get the transcribed text
   */
  async stopRecordingAndTranscribe(): Promise<string> {
    if (!this.recognition) {
      console.warn('[WisprFlow] Speech recognition not available');
      return '';
    }

    if (!this.isRecording) {
      console.warn('[WisprFlow] Not currently recording');
      return this.finalTranscript.trim();
    }

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      
      // Give a small delay to capture any final words
      setTimeout(() => {
        try {
          this.recognition.stop();
        } catch (e) {
          console.log('[WisprFlow] Stop called but recognition already stopped');
          resolve(this.finalTranscript.trim());
        }
      }, 300);
    });
  }

  /**
   * Cancel recording without returning result
   */
  cancelRecording(): void {
    if (this.recognition && this.isRecording) {
      try {
        this.recognition.abort();
      } catch (e) {
        console.log('[WisprFlow] Abort error (non-critical):', e);
      }
      this.isRecording = false;
      this.finalTranscript = '';
      this.resolvePromise = null;
      console.log('[WisprFlow] Recording cancelled');
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}

export default new WisprFlowService();
