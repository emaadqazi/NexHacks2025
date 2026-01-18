/**
 * ElevenLabs Text-to-Speech Service
 */
import { startTTSTrace, endTTSTrace } from './phoenix';
const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';

export class ElevenLabsService {
  private apiKey: string;
  private voiceId: string = '21m00Tcm4TlvDq8ikWAM'; // Rachel
  private isSpeaking: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentTrace: any = null;

  constructor() {
    this.apiKey = API_KEY.trim();
    console.log('[ElevenLabs] Initialized, API key configured:', !!this.apiKey);
  }

  hasApiKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async speak(text: string): Promise<boolean> {
    if (!this.hasApiKey()) {
      console.warn('[ElevenLabs] No API key, falling back to browser speech');
      this.browserSpeak(text);
      return true;
    }

    if (!text || text.trim().length === 0) return false;

    // Stop any current speech
    this.stop();
    this.currentTrace = startTTSTrace(text, this.voiceId); // start trace

    try {
      console.log('[ElevenLabs] Speaking:', text.substring(0, 50) + '...');

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
        }
      );

      if (!response.ok) {
        console.error('[ElevenLabs] API error:', response.status);
        if (this.currentTrace) endTTSTrace(this.currentTrace, false, `API error: ${response.status}`); // trace error end 
        this.browserSpeak(text); // Fallback
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

        this.currentAudio.onerror = () => {
          this.isSpeaking = false;
          resolve(false);
        };

        this.currentAudio.play().catch(() => resolve(false));
      });

    } catch (error) {
      console.error('[ElevenLabs] Error:', error);
      if (this.currentTrace) endTTSTrace(this.currentTrace, false, String(error)); // end trace with error
      this.browserSpeak(text); // Fallback
      return false;
    }
  }

  // Fallback to browser speech synthesis
  private browserSpeak(text: string): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
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