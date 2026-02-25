import Anthropic from '@anthropic-ai/sdk';
import type { Trip, Day } from '@/types';

const client = new Anthropic();

export async function POST(request: Request) {
  let body: { day: Day; trip: Trip };
  try {
    body = await request.json() as { day: Day; trip: Trip };
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { day, trip } = body;

  if (!day?.activities?.length || !trip) {
    return Response.json({ error: 'day with activities and trip required' }, { status: 400 });
  }

  const hasValidCoords = day.activities.every(
    a => typeof a.coordinates?.lat === 'number' && typeof a.coordinates?.lng === 'number'
  );
  if (!hasValidCoords) {
    return Response.json({ error: 'All activities must have valid coordinates' }, { status: 400 });
  }

  const activityList = day.activities.map((a, i) =>
    `${i + 1}. id="${a.id}" [${a.type}] "${a.name}" coords=(${a.coordinates.lat.toFixed(4)},${a.coordinates.lng.toFixed(4)})${a.notes ? ' notes="' + a.notes + '"' : ''}`
  ).join('\n');

  const prompt = `Reorder these Day ${day.dayNumber} activities for the optimal time and experience.

Trip: pace=${trip.tripPace}, dog=${trip.hasDog ? 'yes' : 'no'}, maxDriving=${trip.maxDrivingHours}h

Activities:
${activityList}

Rules:
- Strenuous trails → early morning (cooler, less crowded)
- Hotel/camping check-in → last activity of the day
- Meals → logical meal times (breakfast early, lunch midday, dinner evening)
- Minimize geographic backtracking between stops
- Dog-unfriendly activities → cluster together so dog isn't moved multiple times

Respond with ONLY valid JSON, no markdown, no explanation outside JSON:
{"order":["id_a","id_b","id_c"],"reasoning":"One sentence explaining the key choices."}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    let result: { order: string[]; reasoning: string };
    try {
      result = JSON.parse(text) as { order: string[]; reasoning: string };
    } catch {
      console.error('optimize-day: JSON parse failure, raw text:', text);
      return Response.json({ error: 'Scout returned unparseable response' }, { status: 500 });
    }

    // Validate all returned IDs exist
    const validIds = new Set(day.activities.map(a => a.id));
    const allValid = result.order.every(id => validIds.has(id));
    if (!allValid || result.order.length !== day.activities.length) {
      return Response.json({ error: 'Scout returned invalid activity order' }, { status: 500 });
    }

    return Response.json(result);
  } catch (err) {
    console.error('optimize-day error:', err);
    return Response.json({ error: 'Failed to optimize order' }, { status: 500 });
  }
}
