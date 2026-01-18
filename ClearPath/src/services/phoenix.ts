/**
 * Arize Phoenix Tracing Service for ClearPath
 * With visible stats for demo!
 */

const generateId = (): string => 
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export interface TraceSpan {
  traceId: string;
  spanId: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  status: 'ok' | 'error';
  error?: string;
}

// ============================================
// STATS FOR UI DISPLAY
// ============================================
export interface TraceStats {
  totalTraces: number;
  visionTraces: number;
  ttsTraces: number;
  avgVisionLatency: number;
  avgTTSLatency: number;
  errorCount: number;
  lastTraceTime: string;
}

class PhoenixTracer {
  private pendingSpans: TraceSpan[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  
  // Stats tracking
  private stats: TraceStats = {
    totalTraces: 0,
    visionTraces: 0,
    ttsTraces: 0,
    avgVisionLatency: 0,
    avgTTSLatency: 0,
    errorCount: 0,
    lastTraceTime: '--',
  };
  private visionLatencies: number[] = [];
  private ttsLatencies: number[] = [];
  private statsListeners: ((stats: TraceStats) => void)[] = [];

  constructor() {
    console.log('[Phoenix] Tracing enabled with stats tracking');
    this.startFlushTimer();
  }

  // Subscribe to stats updates (for UI)
  onStatsUpdate(listener: (stats: TraceStats) => void): () => void {
    this.statsListeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.statsListeners = this.statsListeners.filter(l => l !== listener);
    };
  }

  // Get current stats
  getStats(): TraceStats {
    return { ...this.stats };
  }

  private updateStats(spanName: string, latency: number, isError: boolean): void {
    this.stats.totalTraces++;
    this.stats.lastTraceTime = new Date().toLocaleTimeString();
    
    if (isError) {
      this.stats.errorCount++;
    }

    if (spanName.includes('vision')) {
      this.stats.visionTraces++;
      this.visionLatencies.push(latency);
      this.stats.avgVisionLatency = Math.round(
        this.visionLatencies.reduce((a, b) => a + b, 0) / this.visionLatencies.length
      );
    } else if (spanName.includes('tts') || spanName.includes('elevenlabs')) {
      this.stats.ttsTraces++;
      this.ttsLatencies.push(latency);
      this.stats.avgTTSLatency = Math.round(
        this.ttsLatencies.reduce((a, b) => a + b, 0) / this.ttsLatencies.length
      );
    }

    // Notify listeners
    this.statsListeners.forEach(listener => listener(this.getStats()));
  }

  startSpan(name: string, attributes: Record<string, string | number | boolean> = {}): TraceSpan {
    return {
      traceId: generateId(),
      spanId: generateId(),
      name,
      startTime: Date.now(),
      attributes: { 'service.name': 'clearpath-navigation', ...attributes },
      status: 'ok',
    };
  }

  endSpan(span: TraceSpan, outputAttributes: Record<string, string | number | boolean> = {}): void {
    span.endTime = Date.now();
    const latency = span.endTime - span.startTime;
    span.attributes = { ...span.attributes, ...outputAttributes, 'latency_ms': latency };
    this.pendingSpans.push(span);
    
    // Update stats
    this.updateStats(span.name, latency, span.status === 'error');
    
    console.log(`[Phoenix] Traced: ${span.name} (${latency}ms) | Total: ${this.stats.totalTraces}`);
  }

  errorSpan(span: TraceSpan, error: string): void {
    span.status = 'error';
    span.error = error;
    span.attributes['error.message'] = error;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), 5000);
  }

  async flush(): Promise<void> {
    if (this.pendingSpans.length === 0) return;
    const spansToSend = [...this.pendingSpans];
    this.pendingSpans = [];

    try {
      // Try local Phoenix first
      await fetch('http://localhost:6006/v1/traces', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.toOTLP(spansToSend)),
      });
      console.log(`[Phoenix] ✅ Sent ${spansToSend.length} spans to Phoenix`);
    } catch (error) {
      // Silent fail - stats are still tracked locally
      console.log(`[Phoenix] ⚠️ Phoenix unavailable, stats tracked locally (${this.stats.totalTraces} total)`);
    }
  }

  private toOTLP(spans: TraceSpan[]): object {
    return {
      resourceSpans: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'clearpath-navigation' } }] },
        scopeSpans: [{
          scope: { name: 'clearpath-tracer' },
          spans: spans.map(span => ({
            traceId: span.traceId,
            spanId: span.spanId,
            name: span.name,
            kind: 1,
            startTimeUnixNano: span.startTime * 1000000,
            endTimeUnixNano: (span.endTime || Date.now()) * 1000000,
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
              key,
              value: typeof value === 'string' ? { stringValue: value } : typeof value === 'number' ? { intValue: Math.floor(value) } : { boolValue: value },
            })),
            status: { code: span.status === 'ok' ? 1 : 2, message: span.error || '' },
          })),
        }],
      }],
    };
  }
}

export const phoenixTracer = new PhoenixTracer();

export function traceVisionResult(
  promptVariant: string,
  result: { success: boolean; rawResult?: string; processingTime: number; error?: string }
): void {
  const span = phoenixTracer.startSpan('overshoot.vision_result', {
    'input.prompt_variant': promptVariant,
  });
  
  // Use the actual processing time from Overshoot
  span.startTime = Date.now() - result.processingTime;
  
  if (result.success) {
    phoenixTracer.endSpan(span, {
      'output.success': true,
      'output.response': result.rawResult?.substring(0, 500) || '',
      'output.processing_time_ms': result.processingTime,
    });
  } else {
    phoenixTracer.errorSpan(span, result.error || 'Unknown error');
    phoenixTracer.endSpan(span, { 'output.success': false });
  }
}

export function startTTSTrace(text: string, voiceId: string): TraceSpan {
  return phoenixTracer.startSpan('elevenlabs.text_to_speech', {
    'input.text': text.substring(0, 200),
    'input.text_length': text.length,
    'input.voice_id': voiceId,
  });
}

export function endTTSTrace(span: TraceSpan, success: boolean, error?: string): void {
  if (success) {
    phoenixTracer.endSpan(span, { 'output.success': true });
  } else {
    phoenixTracer.errorSpan(span, error || 'TTS failed');
    phoenixTracer.endSpan(span, { 'output.success': false });
  }
}

// Export stats getter for UI
export function getTraceStats(): TraceStats {
  return phoenixTracer.getStats();
}

// Export stats subscriber for real-time UI updates
export function subscribeToStats(listener: (stats: TraceStats) => void): () => void {
  return phoenixTracer.onStatsUpdate(listener);
}

export default phoenixTracer;
