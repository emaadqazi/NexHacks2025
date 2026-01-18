/**
 * Indoor Navigation Assistant for Visually Impaired Users
 * Uses Gemini API to provide step-by-step navigation instructions.
 * 
 * Browser and React Native compatible version using inline images.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

type Verbosity = 'minimal' | 'moderate' | 'detailed';

interface FloorMaps {
  [key: string]: any;
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

// Import floor plan images for browser/Expo
// These will be bundled by the build system
const FLOOR_IMAGES: FloorMaps = {
  lower: require('../../data/lower-level.png'),
  first: require('../../data/first-floor.png'),
  second: require('../../data/second-floor.png'),
  third: require('../../data/third-floor.png'),
};

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
 * Browser-compatible version using inline images
 */
class GeminiNavigationService {
  private apiKey: string;
  private verbosity: Verbosity;
  private genAI: GoogleGenerativeAI;
  private promptTemplate: string;
  private floorMaps: FloorMaps;

  constructor(apiKey?: string, verbosity: Verbosity = 'detailed') {
    // Get API key from parameter or environment variable
    // Check both process.env (Node.js) and direct access (browser with bundler)
    const envKey = typeof process !== 'undefined' && process.env 
      ? (process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY)
      : undefined;
    
    this.apiKey = apiKey || envKey || '';
    
    if (!this.apiKey) {
      throw new Error('Please provide GEMINI_API_KEY or EXPO_PUBLIC_GEMINI_API_KEY environment variable');
    }

    // Validate and set verbosity
    const validVerbosity: Verbosity[] = ['minimal', 'moderate', 'detailed'];
    this.verbosity = verbosity.toLowerCase() as Verbosity;
    if (!validVerbosity.includes(this.verbosity)) {
      throw new Error(`Verbosity must be one of: ${validVerbosity.join(', ')}`);
    }

    // Initialize Gemini API
    this.genAI = new GoogleGenerativeAI(this.apiKey);

    // Use default prompt template
    this.promptTemplate = DEFAULT_PROMPT_TEMPLATE;

    // Use imported floor images
    this.floorMaps = FLOOR_IMAGES;

    console.log('[GeminiNavigation] Service initialized (browser-compatible mode)');
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

  private getFloorPlanImage(floor: string): any {
    const floorLower = floor.toLowerCase();
    if (floorLower in this.floorMaps) {
      return this.floorMaps[floorLower];
    }
    return this.floorMaps['first']; // Default
  }

  /**
   * Convert image to base64 data URI for inline usage
   */
  private async imageToBase64(imageSource: any): Promise<string> {
    // If it's already a data URI, return it
    if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
      return imageSource;
    }

    // Extract the actual URL from the require() result
    let imageUrl: string;
    
    if (typeof imageSource === 'string') {
      imageUrl = imageSource;
    } else if (imageSource && typeof imageSource === 'object') {
      // Expo web bundler returns { default: 'url' } or { uri: 'url' }
      imageUrl = imageSource.default || imageSource.uri || imageSource;
    } else {
      throw new Error('Invalid image source format');
    }

    console.log('[GeminiNavigation] Loading image from:', imageUrl);

    // For Expo/React Native, the require() returns a module object
    // We need to fetch the actual image data
    try {
      // If the URL is relative, make it absolute
      let absoluteUrl: string;
      if (imageUrl.startsWith('http')) {
        absoluteUrl = imageUrl;
      } else {
        // In browser, use window.location.origin
        if (typeof window !== 'undefined' && window.location) {
          absoluteUrl = `${window.location.origin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        } else {
          // Fallback for non-browser environments
          absoluteUrl = imageUrl;
        }
      }
      
      console.log('[GeminiNavigation] Fetching from:', absoluteUrl);
      
      const response = await fetch(absoluteUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log('[GeminiNavigation] Image converted to base64, length:', base64.length);
          resolve(base64);
        };
        reader.onerror = (error) => {
          console.error('[GeminiNavigation] FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('[GeminiNavigation] Error converting image to base64:', error);
      throw new Error(`Failed to load floor plan image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Navigate from one location to another
   * @param query User's navigation query (e.g., "I'm at the fitness center, how do I get to room 205?")
   * @param saveResponse Whether to save the response (not supported in browser)
   * @returns Navigation result with step-by-step instructions
   */
  async navigate(query: string, saveResponse: boolean = false): Promise<NavigationResult> {
    // Detect floor from query
    const floor = this.detectFloor(query);
    console.log(`[GeminiNavigation] Query: ${query}`);
    console.log(`[GeminiNavigation] Detected floor: ${floor}`);
    console.log(`[GeminiNavigation] Verbosity: ${this.verbosity}`);

    // Create the prompt
    const prompt = this.createPrompt(query, floor);

    // Get floor plan image
    const floorPlanImage = this.getFloorPlanImage(floor);
    console.log(`[GeminiNavigation] Loading floor plan for: ${floor}`);

    // Convert image to base64
    const base64Image = await this.imageToBase64(floorPlanImage);
    
    // Extract the base64 data and mime type
    const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image format');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];

    console.log(`[GeminiNavigation] Calling Gemini API with inline image...`);

    // Use inline image data instead of file upload
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
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
      floorPlan: `${floor}-floor`,
      prompt: prompt,
      response: responseText,
    };

    console.log(`[GeminiNavigation] Navigation complete`);
    return navigationResult;
  }
}

// Export service and types
export { GeminiNavigationService, NavigationResult, Verbosity };
export type { FloorMaps };
