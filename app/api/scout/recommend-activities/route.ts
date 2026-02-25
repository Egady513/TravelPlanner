import Anthropic from '@anthropic-ai/sdk';
import type { Trip, Day, ActivityType } from '@/types';

const client = new Anthropic();

interface Suggestion {
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

export async function POST(request: Request) {
  let body: { type: ActivityType; day: Day; trip: Trip };
  try {
    body = await request.json() as { type: ActivityType; day: Day; trip: Trip };
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, day, trip } = body;

  // Fix C1: Input validation
  if (!type || !day?.activities || !trip) {
    return Response.json({ error: 'type, day, and trip are required' }, { status: 400 });
  }

  // Fix C2: Validate ActivityType against allowlist
  const VALID_TYPES = ['trail', 'hotel', 'restaurant', 'camping', 'park', 'driving'] as const;
  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return Response.json({ error: 'Invalid activity type' }, { status: 400 });
  }

  const existingNames = day.activities.map(a => a.name).join(', ') || 'none';
  const locationHint = day.activities.find(a => a.type !== 'driving')?.name
    || day.activities[0]?.name
    || `Day ${day.dayNumber} of the trip`;

  // Fix I3: Changed "4" to "3 to 5"
  const prompt = `You are Scout, a road trip assistant. Suggest 3 to 5 real ${type} options for a road trip day.

Location context: near ${locationHint}
Already planned this day: ${existingNames}
Trip: pace=${trip.tripPace}, dog=${trip.hasDog ? 'yes' : 'no'}, budget=${trip.budgetStyle}, people=${trip.peopleCount}

Requirements:
- Suggest REAL, specific places that actually exist (not generic descriptions)
- Make suggestions that complement what's already planned
- If dog=yes, note whether each place allows dogs
- Match the trip pace and budget

Respond with ONLY valid JSON, no markdown:
{
  "suggestions": [
    {"name": "Exact Place Name", "location": "City, State", "why": "One sentence", "isDogFriendly": true}
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    // Fix I1: Separate JSON.parse into its own try/catch
    let result: { suggestions: Suggestion[] };
    try {
      result = JSON.parse(text) as { suggestions: Suggestion[] };
    } catch {
      console.error('recommend-activities: JSON parse failure, raw text:', text);
      return Response.json({ suggestions: [] });
    }

    // Fix I2: Validate response shape
    if (!Array.isArray(result.suggestions)) {
      return Response.json({ suggestions: [] });
    }

    return Response.json(result);
  } catch (err) {
    console.error('recommend-activities error:', err);
    return Response.json({ error: 'Failed to get recommendations' }, { status: 500 });
  }
}
