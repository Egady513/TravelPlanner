import Anthropic from '@anthropic-ai/sdk';
import type { Trip, Day, ActivityType } from '@/types';

const client = new Anthropic();

interface PlannedActivity {
  type: ActivityType;
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

export async function POST(request: Request) {
  let body: { day: Day; trip: Trip };
  try {
    body = await request.json() as { day: Day; trip: Trip };
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { day, trip } = body;

  if (!day || !trip) {
    return Response.json({ error: 'day and trip required' }, { status: 400 });
  }

  const existingSection = day.activities.length > 0
    ? `Existing activities to keep (plan AROUND these, don't repeat them):\n${day.activities.map(a => `- [${a.type}] ${a.name}`).join('\n')}`
    : 'No activities yet — plan the full day from scratch.';

  // Infer location from existing activities or adjacent days
  const prevDay = trip.days.find(d => d.dayNumber === day.dayNumber - 1);
  const locationActivity = day.activities.find(a => a.type !== 'driving')
    || prevDay?.activities.find(a => a.type === 'hotel' || a.type === 'camping')
    || prevDay?.activities.find(a => a.type !== 'driving');
  const locationHint = locationActivity?.name
    || trip.startingLocation?.address
    || `Day ${day.dayNumber} of the trip`;

  const prompt = `You are Scout, an expert road trip planner. Plan Day ${day.dayNumber}.

Location: near ${locationHint}
${existingSection}

Trip preferences:
- Pace: ${trip.tripPace} (relaxed=fewer/easier, balanced=moderate, adventure=full/challenging)
- Has dog: ${trip.hasDog ? 'yes — all activities must allow dogs or note if dog stays' : 'no'}
- Budget: ${trip.budgetStyle}
- People: ${trip.peopleCount}
- Max driving this day: ${trip.maxDrivingHours}h

Generate 3-5 activities that make a great, cohesive day. Order them as they would happen chronologically. Mix types naturally. Use REAL, specific place names that exist at this location.

Types available: trail, hotel, restaurant, camping, park, driving

Respond with ONLY valid JSON, no markdown:
{
  "activities": [
    {"type": "trail", "name": "Exact Place Name", "location": "City, State", "why": "Why this fits the day", "isDogFriendly": true}
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 768,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const result = JSON.parse(text) as { activities: PlannedActivity[] };
    return Response.json(result);
  } catch (err) {
    console.error('plan-day error:', err);
    return Response.json({ error: 'Failed to plan day' }, { status: 500 });
  }
}
