#!/usr/bin/env node
/**
 * Indoor Navigation Assistant for Visually Impaired Users
 * Uses Gemini API to provide step-by-step navigation instructions.
 * 
 * Can be used as:
 * 1. CLI tool: `npx tsx geminiPathfinding.ts "your query"`
 * 2. Service: import { GeminiNavigationService } from './geminiPathfinding'
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Command } from 'commander';

// Load environment variables
dotenv.config();

type Verbosity = 'minimal' | 'moderate' | 'detailed';

interface FloorMaps {
  [key: string]: string;
}

interface NavigationResult {
  timestamp: string;
  query: string;
  floor: string;
  verbosity: Verbosity;
  floorPlan: string;
  prompt: string;
  response: string;
}

/**
 * Default prompt template for navigation
 * Used when PROMPT.md is not available (e.g., in browser context)
 */
const DEFAULT_PROMPT_TEMPLATE = `Role: You are a specialized Indoor Navigation Assistant for the visually impaired. Your goal is to provide precise, step-by-step walking directions within a university building using provided floor plans.

User Query: [USER_QUERY]

Floor Context: You are viewing the [FLOOR_NAME] floor plan.

Building Scale Information:
- Total building area: 67,163 sq ft
- Estimated floor area: 16,790.75 sq ft per floor
- Use these measurements to accurately calculate distances and convert them to steps (assume average human step is ~2.5 feet)

Task: Analyze the user's query to identify their starting location and destination. Then provide navigation instructions from the starting location to the target destination on the [FLOOR_NAME] floor.

Output Requirements for Accessibility:

Cardinal & Relative Directions: Use "North/South/East/West" relative to the map, but translate them into "Turn left," "Turn right," or "Keep the wall on your [Left/Right]" for the user.

Distance Estimation: 
- Building scale: Total building is 67,163 sq ft; each floor is approximately 16,790.75 sq ft
- Average human step is approximately 2.5 feet
- Use the floor plan dimensions and building scale to calculate accurate distances
- Express distances in steps (e.g., "Walk approximately 20 steps past the Auditorium")
- Provide realistic step counts based on the actual scale of the building

Tactile/Auditory Landmarks: Mention when the user will pass a door (triangle icon) or a transition point like a stairwell.

Safety First: Always alert the user if they are approaching a stairwell or a high-traffic area like a Loading Dock.

Verbosity Level: [VERBOSITY_LEVEL]
- MINIMAL: Provide only essential directions (e.g., "Turn left", "Walk forward 20 steps", "Turn northeast"). No explanations or landmarks.
- MODERATE: Include key landmarks and basic context (e.g., "Turn left at the auditorium entrance, walk 20 steps").
- DETAILED: Provide comprehensive instructions with all landmarks, safety notes, tactile cues, and detailed descriptions (current default behavior).

Format:

Current Orientation: [Direction the user is facing at start]

Step-by-Step Instructions: [Numbered list - adjust detail based on verbosity level]

Destination Confirmation: [Describe the entrance of the target room]`;

/**
 * Gemini Navigation Service
 * Provides pathfinding using Gemini API with floor plan images
 */
class GeminiNavigationService {
  private apiKey: string;
  private verbosity: Verbosity;
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private promptTemplate: string;
  private floorMaps: FloorMaps;

  constructor(apiKey?: string, verbosity: Verbosity = 'detailed') {
    // Get API key from parameter or environment variable
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Please provide GEMINI_API_KEY environment variable');
    }

    // Validate and set verbosity
    const validVerbosity: Verbosity[] = ['minimal', 'moderate', 'detailed'];
    this.verbosity = verbosity.toLowerCase() as Verbosity;
    if (!validVerbosity.includes(this.verbosity)) {
      throw new Error(`Verbosity must be one of: ${validVerbosity.join(', ')}`);
    }

    // Initialize Gemini API
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.fileManager = new GoogleAIFileManager(this.apiKey);

    // Load prompt template
    this.promptTemplate = this.loadPromptTemplate();

    // Map floor names to image files
    this.floorMaps = {
      lower: 'data/lower-level.png',
      first: 'data/first-floor.png',
      second: 'data/second-floor.png',
      third: 'data/third-floor.png',
    };

    console.log('[GeminiNavigation] Service initialized');
  }

  private loadPromptTemplate(): string {
    try {
      const templatePath = path.join(process.cwd(), 'PROMPT.md');
      if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf-8');
      }
    } catch (error) {
      console.warn('[GeminiNavigation] Could not load PROMPT.md, using default template');
    }
    return DEFAULT_PROMPT_TEMPLATE;
  }

  /**
   * Detect which floor the user is asking about from their query
   */
  detectFloor(query: string): string {
    const queryLower = query.toLowerCase();
    const keywords: string[] = [];

    // Check for floor keywords
    if (queryLower.includes('lower') || queryLower.includes('basement')) {
      keywords.push('lower');
    }
    if (queryLower.includes('first') || queryLower.includes('1st') || queryLower.includes('floor one') || queryLower.includes('floor 1')) {
      keywords.push('first');
    }
    if (queryLower.includes('second') || queryLower.includes('2nd') || queryLower.includes('floor two') || queryLower.includes('floor 2')) {
      keywords.push('second');
    }
    if (queryLower.includes('third') || queryLower.includes('3rd') || queryLower.includes('floor three') || queryLower.includes('floor 3')) {
      keywords.push('third');
    }

    if (keywords.length === 0) {
      return 'first';
    }

    return keywords[0]; // TODO: Handle multiple floors
  }

  /**
   * Set the verbosity level for navigation instructions
   */
  setVerbosity(verbosity: Verbosity): void {
    const validVerbosity: Verbosity[] = ['minimal', 'moderate', 'detailed'];
    if (!validVerbosity.includes(verbosity)) {
      throw new Error(`Verbosity must be one of: ${validVerbosity.join(', ')}`);
    }
    this.verbosity = verbosity;
  }

  private createPrompt(userQuery: string, floor: string): string {
    // Map verbosity to description
    const verbosityMap: Record<Verbosity, string> = {
      minimal: 'MINIMAL',
      moderate: 'MODERATE',
      detailed: 'DETAILED',
    };

    // Format the template with actual values
    let prompt = this.promptTemplate.replace('[USER_QUERY]', userQuery);
    prompt = prompt.replace('[FLOOR_NAME]', floor);
    prompt = prompt.replace('[VERBOSITY_LEVEL]', verbosityMap[this.verbosity]);

    return prompt;
  }

  private getFloorPlanPath(floor: string): string {
    const floorLower = floor.toLowerCase();
    if (floorLower in this.floorMaps) {
      return this.floorMaps[floorLower];
    }
    return this.floorMaps['first']; // Default
  }

  /**
   * Navigate from one location to another
   * @param query User's navigation query (e.g., "I'm at the fitness center, how do I get to room 205?")
   * @param saveResponse Whether to save the response to a file (CLI mode)
   * @returns Navigation result with step-by-step instructions
   */
  async navigate(query: string, saveResponse: boolean = true): Promise<NavigationResult> {
    // Detect floor from query
    const floor = this.detectFloor(query);
    console.log(`[GeminiNavigation] Query: ${query}`);
    console.log(`[GeminiNavigation] Detected floor: ${floor}`);
    console.log(`[GeminiNavigation] Verbosity: ${this.verbosity}`);

    // Create the prompt
    const prompt = this.createPrompt(query, floor);

    // Get floor plan image
    const floorPlanPath = this.getFloorPlanPath(floor);

    if (!fs.existsSync(floorPlanPath)) {
      throw new Error(`Floor plan not found: ${floorPlanPath}`);
    }

    console.log(`[GeminiNavigation] Using floor plan: ${floorPlanPath}`);
    console.log(`[GeminiNavigation] Calling Gemini API...`);

    // Upload image and generate response
    const uploadResult = await this.fileManager.uploadFile(floorPlanPath, {
      mimeType: 'image/png',
      displayName: path.basename(floorPlanPath),
    });

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri,
        },
      },
    ]);

    const response = result.response;
    const responseText = response.text();

    const navigationResult: NavigationResult = {
      timestamp: new Date().toISOString(),
      query: query,
      floor: floor,
      verbosity: this.verbosity,
      floorPlan: floorPlanPath,
      prompt: prompt,
      response: responseText,
    };

    // Save response if requested
    if (saveResponse) {
      this.saveResponse(navigationResult);
    }

    console.log(`[GeminiNavigation] Navigation complete`);
    return navigationResult;
  }

  private saveResponse(result: NavigationResult): void {
    try {
      // Create responses directory if it doesn't exist
      const responsesDir = path.join(process.cwd(), 'responses');
      if (!fs.existsSync(responsesDir)) {
        fs.mkdirSync(responsesDir, { recursive: true });
      }

      // Create filename with timestamp
      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/T/, '_')
        .split('.')[0];
      const filename = path.join(responsesDir, `navigation_${timestamp}.json`);

      // Save as JSON
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));

      console.log(`[GeminiNavigation] Response saved to: ${filename}`);
    } catch (error) {
      console.warn('[GeminiNavigation] Could not save response:', error);
    }
  }
}

// Legacy alias for backward compatibility
const NavigationAssistant = GeminiNavigationService;

async function main() {
  const program = new Command();

  program
    .name('navigate')
    .description('Indoor Navigation Assistant for Visually Impaired Users')
    .argument('[query...]', 'Navigation query (e.g., "from entrance to room 205 on second floor")')
    .option(
      '-v, --verbosity <level>',
      'Level of detail in instructions (minimal, moderate, detailed)',
      'detailed'
    )
    .option('--no-save', 'Do not save response to file')
    .addHelpText(
      'after',
      `
Examples:
  $ node navigate.ts "I am at the entrance, how do I get to room 205?"
  $ tsx navigate.ts --verbosity minimal "Navigate to the library"
  $ tsx navigate.ts -v moderate "Second floor, fitness center to conference room"
      `
    );

  program.parse();

  const options = program.opts();
  const queryArgs = program.args;

  // Get query from arguments or use default
  let query: string;
  if (queryArgs.length > 0) {
    query = queryArgs.join(' ');
  } else {
    query = 'i am on the second floor near the fitness center, how can i reach the danforth conference room';
    console.log('No query provided. Using example query:');
    console.log(`Query: ${query}\n`);
  }

  // Validate verbosity
  const verbosity = options.verbosity as Verbosity;
  const validVerbosity: Verbosity[] = ['minimal', 'moderate', 'detailed'];
  if (!validVerbosity.includes(verbosity)) {
    console.error(`❌ Error: Verbosity must be one of: ${validVerbosity.join(', ')}`);
    process.exit(1);
  }

  try {
    // Initialize service with verbosity setting
    const service = new GeminiNavigationService(undefined, verbosity);

    // Process query
    const result = await service.navigate(query, options.save);

    // Print response
    console.log('\n' + '='.repeat(60));
    console.log('NAVIGATION INSTRUCTIONS');
    console.log('='.repeat(60) + '\n');
    console.log(result.response);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error(`❌ Error: ${error}`);
    }
    process.exit(1);
  }
}

// Only run main if this is the entry point (CLI mode)
// Check if we're being run directly vs imported
const isMainModule = typeof require !== 'undefined' && require.main === module;
if (isMainModule) {
  main();
}

// Export service and types
export { GeminiNavigationService, NavigationAssistant, NavigationResult, Verbosity };
