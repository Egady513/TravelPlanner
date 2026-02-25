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

  const existingNames = day.activities.map(a => a.name).join(', ') || 'none';
  const locationHint = day.activities.find(a => a.type !== 'driving')?.name
    || day.activities[0]?.name
    || `Day ${day.dayNumber} of the trip`;

  const prompt = `You are Scout, a road trip assistant. Suggest 4 real ${type} options for a road trip day.

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
    const result = JSON.parse(text) as { suggestions: Suggestion[] };
    return Response.json(result);
  } catch (err) {
    console.error('recommend-activities error:', err);
    return Response.json({ error: 'Failed to get recommendations' }, { status: 500 });
  }
}
