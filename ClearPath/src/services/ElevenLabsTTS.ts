/**
 * ElevenLabs Text-to-Speech Service
 * 
 * Optimized for iOS Safari:
 * - Audio unlock on user gesture
 * - Fallback to browser speech synthesis
 * - Error tracking for diagnostics
 */

const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';

export class ElevenLabsService {
  private apiKey: string;
  private voiceId: string = '21m00Tcm4TlvDq8ikWAM'; // Rachel
  private isSpeaking: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private audioUnlocked: boolean = false;
  private audioContext: AudioContext | null = null;
  private lastError: string | null = null;

  constructor() {
    this.apiKey = API_KEY.trim();
    console.log('[ElevenLabs] Initialized, API key configured:', !!this.apiKey);
  }

  hasApiKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Unlock audio playback on iOS Safari
   * MUST be called from a user gesture (click/tap handler)
   */
  unlockAudio(): void {
    if (this.audioUnlocked) return;

    try {
      // Method 1: Create and resume AudioContext
      if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
        const AudioContextClass = AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().then(() => {
            console.log('[ElevenLabs] AudioContext resumed');
          }).catch(console.error);
        }

        // Play a tiny silent buffer to fully unlock
        const buffer = this.audioContext.createBuffer(1, 1, 22050);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
      }

      // Method 2: Create and play a silent Audio element
      const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/+1DEAABGQANfwAAAJxiAZ/hgAAIAAANIAAAABAMDAgEHAABz/kDgmD6A4JgSBkHwfB+CAIAgCANA+D4PwfB8H4Pg/y4IAgCAIA0D4Pgch8HwfP9QEAQBAEwfB8HwfB8HwfB+IAgCBxFAQP/7UMQGgAgwkz7gBGAguQBn8ACDAAAADIQAAAADAMDZA4JgSBkHwfB+CAIAgCQ/B8HwfB8H4Pg/y4IAgCYPg+D6AIgh8HwfP9QEAQOIoCAEIQhC/');
      silentAudio.volume = 0.01;
      silentAudio.play().then(() => {
        silentAudio.pause();
        console.log('[ElevenLabs] Silent audio played for unlock');
      }).catch(() => {
        // Ignore errors from silent audio
      });

      this.audioUnlocked = true;
      console.log('[ElevenLabs] Audio unlocked');
    } catch (err) {
      console.warn('[ElevenLabs] Audio unlock partial:', err);
      // Mark as unlocked anyway - we tried our best
      this.audioUnlocked = true;
    }
  }

  async speak(text: string): Promise<boolean> {
    if (!text || text.trim().length === 0) return false;

    // Stop any current speech
    this.stop();
    this.lastError = null;

    // Try ElevenLabs API first if we have a key
    if (this.hasApiKey()) {
      const success = await this.speakWithElevenLabs(text);
      if (success) return true;
      // Fall through to browser speech if API fails
    }

    // Fallback to browser speech synthesis
    return this.browserSpeak(text);
  }

  private async speakWithElevenLabs(text: string): Promise<boolean> {
    try {
      console.log('[ElevenLabs] Speaking:', text.substring(0, 50) + '...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text: text.substring(0, 300), // Limit length
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        this.lastError = `ElevenLabs API error ${response.status}: ${errorText.substring(0, 100)}`;
        console.error('[ElevenLabs]', this.lastError);
        return false;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      return new Promise((resolve) => {
        this.currentAudio = new Audio(audioUrl);
        this.isSpeaking = true;

        this.currentAudio.onended = () => {
          this.isSpeaking = false;
          this.currentAudio = null;
          URL.revokeObjectURL(audioUrl);
          resolve(true);
        };

        this.currentAudio.onerror = (e) => {
          this.lastError = 'Audio playback error';
          console.error('[ElevenLabs] Playback error:', e);
          this.isSpeaking = false;
          this.currentAudio = null;
          URL.revokeObjectURL(audioUrl);
          resolve(false);
        };

        // Try to play - this is where iOS might block us
        this.currentAudio.play().then(() => {
          console.log('[ElevenLabs] Playing audio');
        }).catch((err) => {
          this.lastError = `Playback blocked: ${err.message}`;
          console.warn('[ElevenLabs] Play blocked, will use fallback:', err.message);
          URL.revokeObjectURL(audioUrl);
          this.isSpeaking = false;
          this.currentAudio = null;
          resolve(false);
        });
      });

    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.lastError = 'ElevenLabs request timeout';
      } else {
        this.lastError = `ElevenLabs error: ${error.message}`;
      }
      console.error('[ElevenLabs]', this.lastError);
      return false;
    }
  }

  // Fallback to browser speech synthesis
  private browserSpeak(text: string): boolean {
    if (!('speechSynthesis' in window)) {
      this.lastError = 'Speech synthesis not available';
      console.warn('[ElevenLabs] Speech synthesis not available');
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.substring(0, 300));
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      
      // Try to use a female voice if available
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        v.name.toLowerCase().includes('samantha') || 
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('karen')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      this.isSpeaking = true;
      
      utterance.onend = () => {
        this.isSpeaking = false;
      };
      
      utterance.onerror = (e) => {
        console.error('[ElevenLabs] Browser speech error:', e);
        this.isSpeaking = false;
      };

      window.speechSynthesis.speak(utterance);
      console.log('[ElevenLabs] Using browser speech synthesis');
      return true;
    } catch (err: any) {
      this.lastError = `Browser speech failed: ${err.message}`;
      console.error('[ElevenLabs]', this.lastError);
      return false;
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking = false;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}

export default new ElevenLabsService();
