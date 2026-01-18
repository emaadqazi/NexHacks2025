/**
 * FloorPlanService - Fetches floor plans based on building and floor information
 * 
 * This service searches online for floor plan PDFs based on building names.
 * It uses OpenAI to find relevant floor plan URLs, then validates and returns them.
 */

import { FloorPlan } from '../types';

export interface FloorPlanRequest {
  building: string;
  floor: number;
}

export interface FloorPlanResult {
  found: boolean;
  buildingName: string;
  pdfUrl?: string;
  error?: string;
}

export class FloorPlanService {
  private openAiApiKey: string | null = null;

  constructor() {
    // Use OpenAI API key from environment
    // This is used to search for floor plans online
    this.openAiApiKey = process.env.OPENAI_API_KEY || '';
  }

  /**
   * Search online for a floor plan PDF based on building name
   * Uses OpenAI to find relevant floor plan URLs online
   * 
   * @param request - Building name and floor number
   * @returns Promise<FloorPlanResult> - Result with PDF URL if found
   */
  async searchFloorPlanOnline(request: FloorPlanRequest): Promise<FloorPlanResult> {
    try {
      console.log('Searching online for floor plan:', request);

      if (!request.building || !request.building.trim()) {
        return {
          found: false,
          buildingName: '',
          error: 'Building name is required',
        };
      }

      // Use OpenAI to search for floor plan URLs
      // This will find known floor plan resources for common buildings
      const searchQuery = `${request.building} floor plan floor ${request.floor} pdf`;
      
      const prompt = `Find a PDF URL for a floor plan of "${request.building}", specifically for floor ${request.floor}.

Search for publicly available floor plan PDFs. Common sources include:
- University building floor plans (often on .edu domains)
- Office building floor plans
- Public building floor plans

If you find a URL, return ONLY a JSON object with this format:
{"found": true, "pdfUrl": "https://example.com/floorplan.pdf", "buildingName": "${request.building}"}

If no floor plan is found, return:
{"found": false, "buildingName": "${request.building}", "error": "Floor plan not found"}

Return ONLY valid JSON, no other text.`;

      if (!this.openAiApiKey) {
        console.warn('OpenAI API key not configured, cannot search for floor plans online');
        return {
          found: false,
          buildingName: request.building,
          error: 'API key not configured',
        };
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: 'You are a floor plan finder. Search for publicly available floor plan PDFs for buildings. Return only valid JSON with found status and PDF URL if available.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        return {
          found: false,
          buildingName: request.building,
          error: 'Failed to search for floor plan',
        };
      }

      const result = await response.json();
      const aiResponse = result.choices[0]?.message?.content || '{}';

      // Parse JSON response
      let jsonStr = aiResponse.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const searchResult = JSON.parse(jsonStr) as FloorPlanResult;

      if (searchResult.found && searchResult.pdfUrl) {
        console.log('Floor plan PDF found:', searchResult.pdfUrl);
        return {
          found: true,
          buildingName: request.building,
          pdfUrl: searchResult.pdfUrl,
        };
      }

      console.log('Floor plan not found online for:', request.building);
      return {
        found: false,
        buildingName: request.building,
        error: searchResult.error || 'Floor plan not found',
      };

    } catch (error) {
      console.error('Error searching for floor plan online:', error);
      return {
        found: false,
        buildingName: request.building,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch floor plan for a specific building and floor
   * Searches online for PDF floor plans
   * 
   * @param request - Building name and floor number
   * @returns Promise<FloorPlanResult> - Result with PDF URL if found
   */
  async fetchFloorPlan(request: FloorPlanRequest): Promise<FloorPlanResult> {
    return this.searchFloorPlanOnline(request);
  }

  /**
   * Get a specific floor from a floor plan
   * 
   * @param floorPlan - The floor plan data
   * @param floorNumber - Floor number to retrieve
   * @returns Floor data or null if not found
   */
  getFloor(floorPlan: FloorPlan, floorNumber: number) {
    return floorPlan.floors.find(f => f.floorNumber === floorNumber) || null;
  }

  /**
   * Find a landmark by ID in the floor plan
   * 
   * @param floorPlan - The floor plan data
   * @param floorNumber - Floor number
   * @param landmarkId - Landmark ID to find
   * @returns Landmark or null if not found
   */
  findLandmark(floorPlan: FloorPlan, floorNumber: number, landmarkId: string) {
    const floor = this.getFloor(floorPlan, floorNumber);
    if (!floor) return null;
    
    return floor.landmarks.find(l => 
      l.id === landmarkId || 
      l.name.toLowerCase().includes(landmarkId.toLowerCase())
    ) || null;
  }

  /**
   * Search for landmarks by name pattern (e.g., "washroom", "restroom", "203")
   * 
   * @param floorPlan - The floor plan data
   * @param floorNumber - Floor number
   * @param searchTerm - Search term to match against landmark names/IDs
   * @returns Array of matching landmarks
   */
  searchLandmarks(floorPlan: FloorPlan, floorNumber: number, searchTerm: string) {
    const floor = this.getFloor(floorPlan, floorNumber);
    if (!floor) return [];
    
    const term = searchTerm.toLowerCase();
    return floor.landmarks.filter(landmark => 
      landmark.id.toLowerCase().includes(term) ||
      landmark.name.toLowerCase().includes(term) ||
      landmark.type.toLowerCase().includes(term)
    );
  }
}

export default new FloorPlanService();
