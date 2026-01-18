/**
 * WisprFlowService - Handles speech-to-text transcription via Wispr Flow API
 * 
 * This service integrates with Wispr Flow API to convert audio recordings
 * into text transcripts. It supports both WebSocket (streaming) and REST API modes.
 * 
 * Setup Instructions for Wispr Flow:
 * 1. Download Wispr Flow app from https://wispr.ai or install on Mac
 * 2. Get your API key from Wispr Flow dashboard (or use local API if using desktop app)
 * 3. Set WISPR_FLOW_API_KEY in your .env file or environment variables
 * 
 * API Documentation: https://api-docs.wisprflow.ai
 */

// Location data parsed from speech
export interface ParsedLocation {
  building: string;
  floor: number;
  currentRoom: string;
  destinationRoom: string;
}

export class WisprFlowService {
  // Wispr Flow API endpoint - can be configured via environment variable
  private apiKey: string;
  private baseUrl: string = 'https://platform-api.wisprflow.ai/api/v1/dash';
  private jwtToken: string | null = null; // Cached JWT token for client API calls
  private jwtExpiry: number | null = null; // Token expiry timestamp
  
  // OpenAI API key for AI-based parsing (optional - falls back to regex if not set)
  private openAiApiKey: string | null = null;
  private useAIForParsing: boolean = false;
  
  constructor() {
    // For MVP, you can hardcode your API key here
    // In production, use react-native-dotenv or expo-constants
    // 
    // To set up Wispr Flow API:
    // 1. Sign up at https://wispr.ai or use your local Wispr Flow app
    // 2. Get your API key from the dashboard
    // 3. Replace 'YOUR_WISPR_FLOW_API_KEY_HERE' below with your actual API key
    // 
    // See WISPR_FLOW_SETUP.md for detailed setup instructions
    this.apiKey = process.env.WISPR_FLOW_API_KEY;
    
    // Optional: Set OpenAI API key for AI-based parsing
    // Get your API key from https://platform.openai.com/api-keys
    // If set, AI parsing will be used; otherwise falls back to regex patterns
    this.openAiApiKey = process.env.OPENAI_API_KEY;
    this.useAIForParsing = !!this.openAiApiKey;
  }

  /**
   * Generate a JWT access token using the org-level API key
   * Wispr Flow requires a JWT token for client_api endpoints, not the org key directly
   * 
   * @returns Promise<string> - JWT access token
   */
  private async generateAccessToken(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.jwtToken && this.jwtExpiry && Date.now() < this.jwtExpiry) {
        console.log('Using cached JWT token');
        return this.jwtToken;
      }

      console.log('Generating new JWT access token...');
      
      // Call Wispr Flow token generation endpoint with org-level API key
      // Wispr Flow requires client_id and duration_secs in the request body
      const response = await fetch(`${this.baseUrl}/generate_access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          client_id: 'clearpath-mobile-app', // Client identifier for your app
          duration_secs: 3600, // Token valid for 1 hour (3600 seconds)
          metadata: {
            app: 'ClearPath',
            platform: 'react-native-expo',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate access token: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const accessToken = result.access_token || result.token;
      
      if (!accessToken) {
        throw new Error('No access token in response: ' + JSON.stringify(result));
      }

      // Cache the token (expires in ~1 hour typically, cache for 50 minutes to be safe)
      this.jwtToken = accessToken;
      const expiresIn = result.expires_in || 3600; // Default 1 hour
      this.jwtExpiry = Date.now() + (expiresIn - 600) * 1000; // Cache for 10 min less than expiry

      console.log('JWT access token generated successfully');
      return accessToken;
      
    } catch (error) {
      console.error('Error generating access token:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio using Wispr Flow REST API
   * Sends audio file to Wispr Flow and receives transcription text
   * 
   * @param audioUri - Local URI of recorded audio file (e.g., from expo-av)
   * @returns Promise<string> - Transcribed text from the audio
   */
  async transcribeAudio(audioUri: string): Promise<string> {
    try {
      console.log('Starting Wispr Flow transcription for audio:', audioUri);
      
      // First, generate/get a JWT access token (client_api requires JWT, not org key)
      const jwtToken = await this.generateAccessToken();
      
      // Read audio file as base64
      const audioBase64 = await this.audioUriToBase64(audioUri);
      
      // Call Wispr Flow REST API with JWT token
      const response = await fetch(`${this.baseUrl}/client_api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`, // Use JWT token, not org API key
        },
        body: JSON.stringify({
          audio: audioBase64,
          language: ['en'],
          format: 'base64',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wispr Flow API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // Extract transcribed text from response
      // Wispr Flow response format: { body: { text: "..." } }
      const transcript = result.body?.text || result.text || '';
      
      console.log('Wispr Flow transcription result:', transcript);
      return transcript;
      
    } catch (error) {
      console.error('Error in Wispr Flow transcription:', error);
      throw error;
    }
  }

  /**
   * Parse transcribed text into structured location data using AI (OpenAI)
   * Much more robust than regex patterns - understands natural language context
   * 
   * @param transcript - Transcribed text from speech
   * @returns Promise<ParsedLocation> - Structured location data
   */
  private async parseLocationWithAI(transcript: string): Promise<ParsedLocation> {
    if (!this.openAiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      console.log('Using AI to parse transcript:', transcript);

      // Prompt to extract floor, starting point (currentRoom), and destination
      // Note: building is not extracted or stored
      const prompt = `You are an assistant that extracts location information from a spoken sentence. ALWAYS return JSON ONLY, exactly as specified.

RULES:

1. **floor**: Extract the EXACT floor number mentioned. Convert word numbers or ordinals into digits.  
   - Examples:  
     - "floor 2" → 2  
     - "floor two" → 2  
     - "third floor" → 3  
     - "4th floor" → 4  
   - If no floor is mentioned, return 0. DO NOT default to 1.

2. **currentRoom**: Extract the room number/identifier where the user currently is.  
   - Examples:  
     - "room 203" → "203"  
     - "lab 5" → "5"  
   - If no room is mentioned, return an empty string.

3. **destinationRoom**: Extract the COMPLETE destination phrase including all words describing it.  
   - Examples:  
     - "dining hall" → "dining hall"  
     - "conference room" → "conference room"  
     - "men's bathroom" → "men's bathroom"  
   - DO NOT truncate; capture all words.  
   - If no destination is mentioned, return an empty string.

EXAMPLES:

Sentence: "I am in room 203 on floor 2, I want to go to the dining hall."  
Output: {"floor": 2, "currentRoom": "203", "destinationRoom": "dining hall"}

Sentence: "I am on the third floor near lab 5, going to the men's bathroom."  
Output: {"floor": 3, "currentRoom": "5", "destinationRoom": "men's bathroom"}

Sentence: "I am on floor two, heading to the library."  
Output: {"floor": 2, "currentRoom": "", "destinationRoom": "library"}

Sentence: "I am on the fifth floor in room 512, going to the conference room."  
Output: {"floor": 5, "currentRoom": "512", "destinationRoom": "conference room"}

Sentence: "${transcript}"  
Output:

`;

      console.log('Sending to OpenAI with prompt:', prompt);

      // Retry logic for rate limiting (429 errors)
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openAiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
            {
              role: 'system',
              content: 'You extract location info from text. Return ONLY valid JSON. For destinationRoom, always include the COMPLETE phrase (e.g., "dining hall" not "dining"). For floor, use the EXACT number mentioned.',
            },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.1, // Very low temperature for consistent parsing
            max_tokens: 150,
            response_format: { type: 'json_object' }, // Force JSON mode
          }),
        });

        // If rate limited (429), wait and retry with longer delays
        if (response.status === 429) {
          attempts++;
          const waitTime = Math.pow(2, attempts) * 2000; // Longer exponential backoff: 4s, 8s, 16s
          console.warn(`OpenAI rate limit hit (429). Retrying in ${waitTime / 1000}s... (attempt ${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // If other error, throw immediately
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        // Success, break out of retry loop
        break;
      }

      // If we exhausted retries, response should be set but check anyway
      if (!response || (attempts >= maxAttempts && !response.ok)) {
        console.warn('AI parsing hit rate limit, falling back to regex parsing');
        // Instead of throwing, return regex parsing result
        return this.parseLocationWithRegex(transcript);
      }

      const result = await response.json();
      const aiResponse = result.choices[0]?.message?.content || '{}';

      console.log('OpenAI raw response:', aiResponse);

      // Parse JSON from AI response (might have markdown code blocks or extra text)
      let jsonStr = aiResponse.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '').replace(/```\n?$/g, '');
      }
      
      // Extract JSON object if wrapped in other text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      console.log('Extracted JSON string:', jsonStr);

      const parsed = JSON.parse(jsonStr) as Partial<ParsedLocation>;

      // Ensure all fields are present with defaults (building not stored)
      const location: ParsedLocation = {
        building: '', // Building not stored or used
        floor: parsed.floor || 0,
        currentRoom: parsed.currentRoom || '',
        destinationRoom: parsed.destinationRoom || '',
      };

      console.log('AI parsed location:', location);
      return location;

    } catch (error) {
      console.error('Error parsing with AI:', error);
      throw error;
    }
  }

  /**
   * Parse transcribed text into structured location data
   * Uses AI if OpenAI API key is configured, otherwise falls back to regex patterns
   * 
   * Example input:
   *   "I am in room 203 in Wean Hall at Carnegie Mellon University on floor 2, I want to go to the washroom."
   * 
   * Output:
   *   {
   *     building: "Wean Hall",
   *     floor: 2,
   *     currentRoom: "203",
   *     destinationRoom: "washroom"
   *   }
   * 
   * @param transcript - Transcribed text from speech
   * @returns Promise<ParsedLocation> - Structured location data
   */
  async parseLocationFromTranscript(transcript: string): Promise<ParsedLocation> {
    // Use AI parsing if API key is configured
    if (this.useAIForParsing && this.openAiApiKey) {
      try {
        return await this.parseLocationWithAI(transcript);
      } catch (error) {
        console.warn('AI parsing failed, falling back to regex:', error);
        // Fall through to regex parsing
      }
    }

    // Fallback to regex-based parsing
    return this.parseLocationWithRegex(transcript);
  }

  /**
   * Parse transcribed text into structured location data using regex patterns
   * Fallback method when AI is not available
   * 
   * @param transcript - Transcribed text from speech
   * @returns ParsedLocation - Structured location data
   */
  private parseLocationWithRegex(transcript: string): ParsedLocation {
    const text = transcript.toLowerCase().trim();
    const parsed: Partial<ParsedLocation> = {
      building: '',
      floor: 0,
      currentRoom: '',
      destinationRoom: '',
    };

    console.log('Parsing transcript:', transcript);

    // Extract current room - multiple patterns for better matching
    // Patterns: "room 100", "in room 100", "room number 100", just "100" after "room", "room100"
    const roomPatterns = [
      /room\s+number\s+(\d+)/i,
      /room\s+(\d+)/i,
      /in\s+room\s+(\d+)/i,
      /room(\d+)/i,
      /(\d+)\s*(?:\s|$|,|\.)/, // Any standalone number (more flexible)
    ];
    
    for (const pattern of roomPatterns) {
      const match = text.match(pattern);
      if (match) {
        parsed.currentRoom = match[1];
        console.log('Found room:', match[1], 'using pattern:', pattern.toString());
        break;
      }
    }

    // Extract floor number - multiple patterns including word numbers
    const floorPatterns = [
      /floor\s+(\d+)/i,
      /on\s+floor\s+(\d+)/i,
      /floor\s+number\s+(\d+)/i,
      /level\s+(\d+)/i,
      /(\d+)(?:st|nd|rd|th)\s+floor/i, // "2nd floor", "3rd floor"
    ];
    
    // Word to number mapping for "first floor", "second floor", etc.
    const wordToNumber: { [key: string]: number } = {
      'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
      'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
      'ground': 0, 'basement': -1,
    };
    
    // Check word patterns first
    const wordFloorMatch = text.match(/(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|ground|basement)\s+floor/i);
    if (wordFloorMatch) {
      const wordNum = wordToNumber[wordFloorMatch[1].toLowerCase()];
      if (wordNum !== undefined) {
        parsed.floor = wordNum;
        console.log('Found floor (word):', wordFloorMatch[1], '→', wordNum);
      }
    } else {
      // Check numeric patterns
      for (const pattern of floorPatterns) {
        const match = text.match(pattern);
        if (match) {
          parsed.floor = parseInt(match[1], 10);
          console.log('Found floor:', match[1]);
          break;
        }
      }
    }

    // Extract building name - improved patterns to catch more variations
    // Patterns: "in the office building", "in office building", "the office building", "office building", "building name", "in [name] hall"
    const buildingPatterns = [
      /in\s+the\s+([a-z\s]+?)\s+building/i,  // "in the office building"
      /in\s+([a-z\s]+?)\s+building/i,        // "in office building"  
      /the\s+([a-z\s]+?)\s+building/i,       // "the office building"
      /([a-z\s]+?)\s+building/i,             // "office building" (more general)
      /in\s+([a-z\s]+?)\s+hall/i,            // "in Wean Hall"
      /([a-z\s]+?)\s+hall/i,                 // "Wean Hall"
      /at\s+([a-z\s]+?)(?:\s+at|\s+on|,|\s+I|\s+in\s+room)/i,  // "at Carnegie Mellon University"
      /in\s+([a-z\s]+?)(?:\s+at|\s+on|,|\s+in\s+room|\s+room)/i, // "in Wean"
    ];
    
    for (const pattern of buildingPatterns) {
      const match = text.match(pattern);
      if (match) {
        const buildingName = match[1].trim();
        // Filter out common words that shouldn't be building names
        if (buildingName && 
            !buildingName.match(/^(the|a|an|this|that|am|i|want|go|to|in|on|at|room|floor|number)$/i) &&
            buildingName.length > 2) {
          parsed.building = buildingName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          console.log('Found building:', parsed.building, 'using pattern:', pattern.toString());
          break;
        }
      }
    }

    // Extract destination - improved patterns to capture full phrases like "dining hall"
    // Using greedy matching and stopping at sentence end or specific keywords
    const destinationPatterns = [
      /(?:go to|want to go to|going to|navigate to|take me to)\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)*)(?:\.|,|$)/i,
      /(?:go to|want to go to|going to|navigate to|take me to)\s+(?:the\s+)?([a-z\s]+)/i,
      /destination\s+(?:is\s+)?(?:the\s+)?([a-z]+(?:\s+[a-z]+)*)/i,
      /want\s+to\s+(?:go\s+to\s+)?(?:the\s+)?([a-z]+(?:\s+[a-z]+)*)/i,
    ];
    
    for (const pattern of destinationPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Clean up the destination - remove trailing articles and prepositions
        let dest = match[1].trim();
        // Remove trailing words that aren't part of the destination
        dest = dest.replace(/\s+(and|or|but|so|to|from|in|on|at|the|a|an)$/i, '').trim();
        // Filter out empty or very short destinations
        if (dest && dest.length > 2) {
          parsed.destinationRoom = dest;
          console.log('Found destination:', dest);
          break;
        }
      }
    }

    // Fallback: if no building found but common building terms are mentioned
    if (!parsed.building) {
      if (text.includes('carnegie mellon') || text.includes('cmu')) {
        // Look for specific building mentions
        if (text.includes('wean')) {
          parsed.building = 'Wean Hall';
        } else if (text.includes('gates')) {
          parsed.building = 'Gates Hall';
        } else {
          parsed.building = 'Carnegie Mellon University';
        }
      } else if (text.includes('office')) {
        // If "office" is mentioned, use "Office Building" as fallback
        parsed.building = 'Office Building';
      }
    }

    // Default floor to 1 if not specified
    if (parsed.floor === 0) {
      parsed.floor = 1;
    }

    console.log('Final parsed location:', parsed);
    
    return parsed as ParsedLocation;
  }

  /**
   * Convert audio URI to base64 string for API submission
   * Uses XMLHttpRequest which is supported natively in React Native
   * 
   * @param audioUri - Local file URI (e.g., file:///path/to/audio.m4a)
   * @returns Promise<string> - Base64 encoded audio
   */
  private async audioUriToBase64(audioUri: string): Promise<string> {
    try {
      // Use XMLHttpRequest which React Native supports natively
      // This works for both file:// URIs and HTTP URIs
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', audioUri, true);
        xhr.responseType = 'blob';
        
        xhr.onload = function() {
          if (xhr.status === 200 || xhr.status === 0) {
            // Convert blob to base64 using FileReader (available in React Native)
            const reader = new FileReader();
            reader.onloadend = function() {
              const base64data = (reader.result as string) || '';
              // Remove data URL prefix if present (data:audio/m4a;base64,)
              const base64 = base64data.includes(',') 
                ? base64data.split(',')[1] 
                : base64data;
              resolve(base64);
            };
            reader.onerror = function() {
              reject(new Error('Failed to convert blob to base64'));
            };
            reader.readAsDataURL(xhr.response);
          } else {
            reject(new Error(`Failed to read file: HTTP ${xhr.status}`));
          }
        };
        
        xhr.onerror = function() {
          reject(new Error('Network error reading audio file'));
        };
        
        xhr.send();
      });
      
    } catch (error) {
      console.error('Error converting audio to base64:', error);
      throw new Error(`Failed to read audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Complete flow: Transcribe audio and parse into structured location
   * 
   * @param audioUri - Local URI of recorded audio file
   * @returns Promise<ParsedLocation> - Structured location data
   */
  async transcribeAndParse(audioUri: string): Promise<ParsedLocation> {
    const transcript = await this.transcribeAudio(audioUri);
    const parsed = this.parseLocationFromTranscript(transcript);
    return parsed;
  }
}

export default new WisprFlowService();
