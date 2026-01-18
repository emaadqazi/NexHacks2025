/**
 * Speech-to-Text Service using Web Speech API
 * Real-time speech recognition for navigation commands
 * 
 * Supports two modes:
 * 1. Recording mode: Start/stop to capture full speech (for destination queries)
 * 2. Continuous command mode: Listen for keywords (next, previous, repeat, stop)
 */

export type VoiceCommand = 'next' | 'previous' | 'repeat' | 'stop' | 'help' | 'where';
export type CommandCallback = (command: VoiceCommand) => void;

// Command keywords and their variations
const COMMAND_KEYWORDS: Record<VoiceCommand, string[]> = {
  next: ['next', 'next step', 'continue', 'go on', 'forward', 'proceed'],
  previous: ['previous', 'back', 'go back', 'last step', 'before'],
  repeat: ['repeat', 'again', 'say again', 'what', 'pardon', 'sorry'],
  stop: ['stop', 'cancel', 'end', 'quit', 'exit', 'done', 'finish'],
  help: ['help', 'commands', 'what can i say', 'options'],
  where: ['where am i', 'current step', 'where', 'location'],
};

export class WisprFlowService {
  private recognition: any = null;
  private commandRecognition: any = null;
  private isRecording: boolean = false;
  private isContinuousListening: boolean = false;
  private finalTranscript: string = '';
  private resolvePromise: ((text: string) => void) | null = null;
  private commandCallback: CommandCallback | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('[WisprFlow] Web Speech API not supported in this browser');
      return;
    }

    // Main recognition for full speech capture
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
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

    // Separate recognition instance for continuous command listening
    this.commandRecognition = new SpeechRecognition();
    this.commandRecognition.lang = 'en-US';
    this.commandRecognition.continuous = true;
    this.commandRecognition.interimResults = false; // Only final results for commands
    this.commandRecognition.maxAlternatives = 1;

    this.commandRecognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.toLowerCase().trim();
          console.log('[WisprFlow] Command heard:', transcript);
          this.processCommand(transcript);
        }
      }
    };

    this.commandRecognition.onerror = (event: any) => {
      // Ignore no-speech errors in continuous mode
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      console.error('[WisprFlow] Command recognition error:', event.error);
    };

    this.commandRecognition.onend = () => {
      // Auto-restart if continuous listening is enabled
      if (this.isContinuousListening) {
        console.log('[WisprFlow] Restarting continuous command listening...');
        setTimeout(() => {
          if (this.isContinuousListening) {
            try {
              this.commandRecognition.start();
            } catch (e) {
              // Already started, ignore
            }
          }
        }, 100);
      }
    };

    console.log('[WisprFlow] Web Speech API initialized successfully');
  }

  /**
   * Process transcript to detect voice commands
   */
  private processCommand(transcript: string): void {
    if (!this.commandCallback) return;

    const lowerTranscript = transcript.toLowerCase();

    // Check each command type
    for (const [command, keywords] of Object.entries(COMMAND_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerTranscript.includes(keyword)) {
          console.log(`[WisprFlow] Detected command: ${command}`);
          this.commandCallback(command as VoiceCommand);
          return; // Only fire one command per transcript
        }
      }
    }
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

  /**
   * Start continuous listening for voice commands
   * Detects: next, previous, repeat, stop, help, where
   * @param onCommand Callback fired when a command is detected
   */
  startContinuousListening(onCommand: CommandCallback): boolean {
    if (!this.commandRecognition) {
      console.error('[WisprFlow] Command recognition not available');
      return false;
    }

    if (this.isContinuousListening) {
      console.warn('[WisprFlow] Already listening for commands');
      return true;
    }

    // Stop any regular recording first
    if (this.isRecording) {
      this.cancelRecording();
    }

    this.commandCallback = onCommand;
    this.isContinuousListening = true;

    try {
      this.commandRecognition.start();
      console.log('[WisprFlow] Continuous command listening started');
      return true;
    } catch (error: any) {
      if (error.message?.includes('already started')) {
        console.log('[WisprFlow] Command recognition already running');
        return true;
      }
      console.error('[WisprFlow] Failed to start command listening:', error);
      this.isContinuousListening = false;
      return false;
    }
  }

  /**
   * Stop continuous command listening
   */
  stopContinuousListening(): void {
    if (!this.commandRecognition || !this.isContinuousListening) {
      return;
    }

    this.isContinuousListening = false;
    this.commandCallback = null;

    try {
      this.commandRecognition.abort();
      console.log('[WisprFlow] Continuous command listening stopped');
    } catch (e) {
      console.log('[WisprFlow] Command abort error (non-critical):', e);
    }
  }

  /**
   * Check if continuous command listening is active
   */
  isContinuousListeningActive(): boolean {
    return this.isContinuousListening;
  }

  /**
   * Get available voice commands
   */
  getAvailableCommands(): string[] {
    return Object.keys(COMMAND_KEYWORDS);
  }

  /**
   * Get help text for voice commands
   */
  getCommandsHelpText(): string {
    return `Available voice commands:
- "Next" or "Continue" - Go to next step
- "Previous" or "Back" - Go to previous step  
- "Repeat" or "Again" - Repeat current step
- "Stop" or "Done" - End navigation
- "Where" - Hear current step
- "Help" - List available commands`;
  }
}

export default new WisprFlowService();
