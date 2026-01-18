/**
 * Navigation Steps Manager
 * 
 * Parses LLM navigation responses into discrete steps and manages
 * step-by-step progression for voice-guided navigation.
 * 
 * Features:
 * - Parse "STEP X:" formatted responses from Gemini
 * - Track current step position
 * - Support next/previous/repeat navigation
 * - Format steps for TTS output
 */

export interface NavigationStep {
  index: number;
  instruction: string;
  isLandmark: boolean;
  hasDistance: boolean;
  distanceSteps?: number;
}

export interface ParsedNavigation {
  steps: NavigationStep[];
  rawResponse: string;
  totalSteps: number;
}

/**
 * NavigationStepsManager Class
 * Handles parsing and navigation through step-by-step instructions
 */
export class NavigationStepsManager {
  private steps: NavigationStep[] = [];
  private currentStepIndex: number = 0;
  private rawResponse: string = '';

  constructor() {
    this.reset();
  }

  /**
   * Parse an LLM response into individual navigation steps
   * Expects format: "STEP 1: instruction\nSTEP 2: instruction\n..."
   */
  parseSteps(llmResponse: string): ParsedNavigation {
    this.rawResponse = llmResponse;
    this.steps = [];
    this.currentStepIndex = 0;

    if (!llmResponse || typeof llmResponse !== 'string') {
      console.warn('[NavigationStepsManager] Empty or invalid response');
      return { steps: [], rawResponse: '', totalSteps: 0 };
    }

    // Match "STEP X:" pattern (case-insensitive)
    const stepPattern = /STEP\s*(\d+)\s*:\s*([^\n]+)/gi;
    let match;

    while ((match = stepPattern.exec(llmResponse)) !== null) {
      const stepNumber = parseInt(match[1], 10);
      const instruction = match[2].trim();

      if (instruction.length > 0) {
        const step = this.createStep(stepNumber, instruction);
        this.steps.push(step);
      }
    }

    // If no STEP pattern found, try to parse numbered list (1., 2., etc.)
    if (this.steps.length === 0) {
      const numberedPattern = /(\d+)\.\s*([^\n]+)/g;
      while ((match = numberedPattern.exec(llmResponse)) !== null) {
        const stepNumber = parseInt(match[1], 10);
        const instruction = match[2].trim();

        if (instruction.length > 0) {
          const step = this.createStep(stepNumber, instruction);
          this.steps.push(step);
        }
      }
    }

    // If still no steps found, treat each line as a step
    if (this.steps.length === 0) {
      const lines = llmResponse.split('\n').filter(line => line.trim().length > 0);
      lines.forEach((line, index) => {
        const step = this.createStep(index + 1, line.trim());
        this.steps.push(step);
      });
    }

    // Sort steps by index
    this.steps.sort((a, b) => a.index - b.index);

    // Re-index steps starting from 0
    this.steps = this.steps.map((step, idx) => ({
      ...step,
      index: idx,
    }));

    console.log(`[NavigationStepsManager] Parsed ${this.steps.length} steps`);

    return {
      steps: this.steps,
      rawResponse: this.rawResponse,
      totalSteps: this.steps.length,
    };
  }

  /**
   * Create a NavigationStep from parsed instruction
   */
  private createStep(index: number, instruction: string): NavigationStep {
    // Check for landmark keywords
    const landmarkKeywords = [
      'elevator', 'stairs', 'stairwell', 'door', 'entrance', 'exit',
      'bathroom', 'restroom', 'washroom', 'lobby', 'reception',
      'fitness', 'gym', 'cafeteria', 'auditorium', 'conference'
    ];
    const isLandmark = landmarkKeywords.some(keyword => 
      instruction.toLowerCase().includes(keyword)
    );

    // Extract distance in steps
    const distanceMatch = instruction.match(/(\d+)\s*steps?/i);
    const hasDistance = !!distanceMatch;
    const distanceSteps = distanceMatch ? parseInt(distanceMatch[1], 10) : undefined;

    return {
      index,
      instruction,
      isLandmark,
      hasDistance,
      distanceSteps,
    };
  }

  /**
   * Get current step
   */
  getCurrentStep(): NavigationStep | null {
    if (this.steps.length === 0) return null;
    return this.steps[this.currentStepIndex] || null;
  }

  /**
   * Get current step index (0-based)
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  /**
   * Get total number of steps
   */
  getTotalSteps(): number {
    return this.steps.length;
  }

  /**
   * Move to next step and return it
   */
  getNextStep(): NavigationStep | null {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      return this.getCurrentStep();
    }
    return null; // Already at last step
  }

  /**
   * Move to previous step and return it
   */
  getPreviousStep(): NavigationStep | null {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      return this.getCurrentStep();
    }
    return null; // Already at first step
  }

  /**
   * Check if there's a next step available
   */
  hasNextStep(): boolean {
    return this.currentStepIndex < this.steps.length - 1;
  }

  /**
   * Check if there's a previous step available
   */
  hasPreviousStep(): boolean {
    return this.currentStepIndex > 0;
  }

  /**
   * Check if at the last step
   */
  isAtLastStep(): boolean {
    return this.currentStepIndex === this.steps.length - 1;
  }

  /**
   * Check if at the first step
   */
  isAtFirstStep(): boolean {
    return this.currentStepIndex === 0;
  }

  /**
   * Get multiple steps for speech (current + next N-1 steps)
   * @param count Number of steps to return (default 2)
   */
  getStepsForSpeech(count: number = 2): string {
    if (this.steps.length === 0) return '';

    const stepsToSpeak: string[] = [];
    
    for (let i = 0; i < count && this.currentStepIndex + i < this.steps.length; i++) {
      const step = this.steps[this.currentStepIndex + i];
      stepsToSpeak.push(`Step ${step.index + 1}: ${step.instruction}`);
    }

    return stepsToSpeak.join(' ');
  }

  /**
   * Get current step formatted for speech
   */
  getCurrentStepForSpeech(): string {
    const step = this.getCurrentStep();
    if (!step) return 'No navigation steps available.';
    
    const position = `Step ${step.index + 1} of ${this.steps.length}`;
    return `${position}. ${step.instruction}`;
  }

  /**
   * Get progress info
   */
  getProgress(): { current: number; total: number; percentage: number } {
    const current = this.currentStepIndex + 1;
    const total = this.steps.length;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    
    return { current, total, percentage };
  }

  /**
   * Jump to a specific step (0-based index)
   */
  goToStep(index: number): NavigationStep | null {
    if (index >= 0 && index < this.steps.length) {
      this.currentStepIndex = index;
      return this.getCurrentStep();
    }
    return null;
  }

  /**
   * Get all steps
   */
  getAllSteps(): NavigationStep[] {
    return [...this.steps];
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.steps = [];
    this.currentStepIndex = 0;
    this.rawResponse = '';
  }

  /**
   * Get raw LLM response
   */
  getRawResponse(): string {
    return this.rawResponse;
  }

  /**
   * Format all steps as a readable string (for display)
   */
  formatAllStepsForDisplay(): string {
    if (this.steps.length === 0) return 'No steps available.';

    return this.steps
      .map(step => `${step.index + 1}. ${step.instruction}`)
      .join('\n');
  }
}

// Export singleton instance
export default new NavigationStepsManager();
