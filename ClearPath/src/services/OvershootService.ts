/**
 * Overshoot Service for Expo Go
 * 
 * Attempts WebSocket connection with various auth methods
 * Falls back to single-frame REST analysis
 */

// Environment variables
const API_URL = process.env.EXPO_PUBLIC_OVERSHOOT_API_URL || 'https://cluster1.overshoot.ai/api/v0.2';
const API_KEY = process.env.EXPO_PUBLIC_OVERSHOOT_API_KEY || '';

// Types
export interface DetectionResult {
  success: boolean;
  description: string;
  processingTime: number;
  error?: string;
  raw?: any;
}

// Debug log storage
let debugLogs: string[] = [];

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  const log = `[${timestamp}] ${message}`;
  console.log(log);
  debugLogs.push(log);
  if (debugLogs.length > 100) debugLogs.shift();
};

/**
 * Overshoot Service
 */
class OvershootService {
  private apiKey: string;
  private apiUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isStreaming: boolean = false;
  private onResultCallback: ((result: DetectionResult) => void) | null = null;
  private prompt: string = '';
  private frameCount: number = 0;

  constructor() {
    this.apiKey = API_KEY.trim();
    this.apiUrl = API_URL.trim();
    this.wsUrl = this.apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    
    addLog('=== OVERSHOOT SERVICE INIT ===');
    addLog(`API URL: ${this.apiUrl}`);
    addLog(`WS URL: ${this.wsUrl}`);
    
    if (this.apiKey) {
      addLog(`API Key: ${this.apiKey.substring(0, 8)}... (${this.apiKey.length} chars)`);
      addLog('✅ API KEY LOADED');
    } else {
      addLog('❌ API KEY NOT SET');
    }
  }

  getDebugLogs(): string[] {
    return [...debugLogs];
  }

  clearLogs(): void {
    debugLogs = [];
  }

  hasApiKey(): boolean {
    return this.apiKey.length > 0;
  }

  isActive(): boolean {
    return this.isStreaming && this.isConnected;
  }

  getConnectionStatus(): string {
    if (!this.ws) return 'Not connected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'Connecting...';
      case WebSocket.OPEN: return 'Connected';
      case WebSocket.CLOSING: return 'Closing...';
      case WebSocket.CLOSED: return 'Disconnected';
      default: return 'Unknown';
    }
  }

  /**
   * Start streaming
   */
  async startStreaming(
    onResult: (result: DetectionResult) => void,
    prompt?: string
  ): Promise<boolean> {
    if (!this.hasApiKey()) {
      addLog('❌ No API key');
      onResult({
        success: false,
        description: '',
        processingTime: 0,
        error: 'API key not configured',
      });
      return false;
    }

    this.onResultCallback = onResult;
    this.prompt = prompt || 'Describe what you see for navigation. Identify obstacles, doors, signs, and paths.';
    this.frameCount = 0;

    addLog('=== STARTING STREAM ===');
    addLog(`Prompt: "${this.prompt.substring(0, 40)}..."`);

    // Try WebSocket connection
    const connected = await this.connectWebSocket();
    
    if (!connected) {
      // WebSocket failed - explain the situation
      addLog('');
      addLog('═══════════════════════════════════════');
      addLog('   WebSocket auth failed (403)');
      addLog('');
      addLog('   Overshoot requires browser SDK.');
      addLog('   Use web mode instead:');
      addLog('');
      addLog('   1. Run: npm run tunnel');
      addLog('   2. Open URL in Safari on iPhone');
      addLog('   3. The SDK will work in browser');
      addLog('═══════════════════════════════════════');
      
      onResult({
        success: false,
        description: '',
        processingTime: 0,
        error: 'WebSocket auth failed. Use web mode: npm run tunnel → Safari',
      });
    }
    
    return connected;
  }

  /**
   * Connect to WebSocket - try multiple approaches
   */
  private async connectWebSocket(): Promise<boolean> {
    // Approach 1: Try with Bearer token in URL
    const urls = [
      `${this.wsUrl}/stream?authorization=Bearer ${this.apiKey}`,
      `${this.wsUrl}/stream?api_key=${this.apiKey}`,
      `${this.wsUrl}?api_key=${this.apiKey}`,
    ];

    for (const url of urls) {
      addLog(`Trying: ${url.substring(0, 60)}...`);
      
      const result = await this.tryWebSocketConnection(url);
      if (result) return true;
    }

    // Approach 2: Connect without auth in URL, send auth as first message
    addLog('Trying: auth via first message...');
    const noAuthUrl = `${this.wsUrl}/stream`;
    const result = await this.tryWebSocketConnection(noAuthUrl, true);
    if (result) return true;

    return false;
  }

  /**
   * Try a single WebSocket connection
   */
  private tryWebSocketConnection(url: string, sendAuthMessage: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        addLog('⏱️ Connection timeout');
        this.ws?.close();
        resolve(false);
      }, 5000);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          addLog('✅ WebSocket opened!');
          this.isConnected = true;
          this.isStreaming = true;

          // If we need to send auth as first message
          if (sendAuthMessage) {
            const authMsg = {
              type: 'auth',
              api_key: this.apiKey,
              apiKey: this.apiKey,
              token: this.apiKey,
            };
            this.ws?.send(JSON.stringify(authMsg));
            addLog('📤 Auth message sent');
          }

          // Send config
          this.sendConfig();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          addLog('❌ WebSocket error');
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.isConnected = false;
          
          if (event.code === 1006 && event.reason?.includes('403')) {
            addLog(`❌ 403 Forbidden - Auth rejected`);
          } else if (event.code !== 1000) {
            addLog(`❌ Closed: ${event.code} ${event.reason || ''}`);
          }
          
          if (!this.isConnected) {
            resolve(false);
          }
        };
      } catch (e: any) {
        clearTimeout(timeout);
        addLog(`❌ Exception: ${e.message}`);
        resolve(false);
      }
    });
  }

  /**
   * Send configuration
   */
  private sendConfig(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const config = {
      type: 'config',
      prompt: this.prompt,
      api_key: this.apiKey,
      settings: {
        fps: 5,
        quality: 0.5,
      },
    };

    this.ws.send(JSON.stringify(config));
    addLog('📤 Config sent');
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);
      addLog(`📥 ${msg.type || 'message'}`);

      if (msg.type === 'result' || msg.result) {
        const result: DetectionResult = {
          success: true,
          description: msg.result || msg.text || '',
          processingTime: msg.latency_ms || 0,
          raw: msg,
        };
        addLog(`🎯 ${result.description.substring(0, 40)}...`);
        this.onResultCallback?.(result);
      } else if (msg.type === 'error' || msg.error) {
        addLog(`❌ ${msg.error || msg.message}`);
        this.onResultCallback?.({
          success: false,
          description: '',
          processingTime: 0,
          error: msg.error || msg.message,
        });
      }
    } catch {
      if (typeof data === 'string' && data.length > 0) {
        addLog(`📥 ${data.substring(0, 40)}...`);
      }
    }
  }

  /**
   * Send a frame
   */
  sendFrame(base64Image: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.frameCount++;

    const frameData = {
      type: 'frame',
      frame_id: this.frameCount,
      image: base64Image,
      prompt: this.prompt,
    };

    try {
      this.ws.send(JSON.stringify(frameData));
      if (this.frameCount % 5 === 0) {
        addLog(`📤 Frame ${this.frameCount}`);
      }
    } catch (e: any) {
      addLog(`❌ Send error`);
    }
  }

  /**
   * Stop streaming
   */
  async stopStreaming(): Promise<void> {
    addLog('Stopping...');
    this.isStreaming = false;

    if (this.ws) {
      try {
        this.ws.close(1000);
      } catch {}
      this.ws = null;
    }

    this.isConnected = false;
    this.onResultCallback = null;
    addLog('Stopped');
  }

  /**
   * Analyze single frame via REST (fallback)
   */
  async analyzeFrame(base64Image: string, prompt?: string): Promise<DetectionResult> {
    if (!this.hasApiKey()) {
      return {
        success: false,
        description: '',
        processingTime: 0,
        error: 'No API key',
      };
    }

    const startTime = Date.now();
    addLog('=== SINGLE FRAME ANALYSIS ===');

    // Try REST endpoints
    const endpoints = ['/inference', '/analyze', '/vision/analyze'];

    for (const endpoint of endpoints) {
      const url = `${this.apiUrl}${endpoint}`;
      addLog(`POST ${endpoint}`);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64Image,
            prompt: prompt || this.prompt,
          }),
        });

        const ms = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          addLog(`✅ ${ms}ms`);
          return {
            success: true,
            description: data.result || data.text || JSON.stringify(data),
            processingTime: ms,
            raw: data,
          };
        } else {
          addLog(`❌ ${response.status}`);
        }
      } catch (e: any) {
        addLog(`❌ ${e.message}`);
      }
    }

    return {
      success: false,
      description: '',
      processingTime: Date.now() - startTime,
      error: 'No REST endpoint. Use web mode: npm run tunnel → Safari',
    };
  }
}

export default new OvershootService();
