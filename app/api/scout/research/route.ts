import Anthropic from '@anthropic-ai/sdk';
import type { Trip } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { trip } = await req.json() as { trip: Trip };

    // Build a description of the route
    const routeStops = trip.days.flatMap(d =>
      d.activities
        .filter(a => a.type !== 'driving')
        .map(a => a.name)
    ).filter(Boolean);

    const drivingLegs = trip.days.flatMap(d =>
      d.activities
        .filter(a => a.type === 'driving')
        .map(a => a.name)
    );

    const routeDescription = [
      `Trip name: ${trip.name}`,
      `Duration: ${trip.days.length} days`,
      `Stops: ${Array.from(new Set(routeStops)).join(', ')}`,
      drivingLegs.length > 0 ? `Driving legs: ${drivingLegs.join('; ')}` : '',
      trip.hasDog ? 'Traveling with a dog.' : '',
    ].filter(Boolean).join('\n');

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `You are a world-class American road trip expert with encyclopedic knowledge of every region, hidden gem, and unmissable experience. I need you to generate a destination intelligence brief for this trip.

${routeDescription}

Write a concise but rich intelligence brief covering:

**HIDDEN GEMS** — 3-4 places most tourists completely miss that are absolutely worth it. Be specific (exact names, locations).

**UNMISSABLE MOMENTS** — 2-3 experiences that define this route. The things someone would regret skipping.

**TIMING SECRETS** — The best times to visit key spots (sunrise/sunset, beat the crowds, seasonal considerations for the travel period).

**LOCAL EATS** — 2-3 specific restaurants, food trucks, or local spots that are genuinely special — not just "there are good restaurants here."

**THE WOW FACTOR** — The single most surprising or breathtaking thing about this route that most people don't know to expect. The thing that makes people say "I never would have found this."
${trip.hasDog ? '\n**DOG-FRIENDLY HIGHLIGHTS** — The best spots specifically great for dogs on this route.' : ''}

Be specific. Name exact places. Give actionable insider tips. This is for a trip advisor who wants to give clients a genuinely exceptional experience.`,
      }],
    });

    const brief = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ brief });
  } catch (err) {
    console.error('[scout/research]', err);
    return NextResponse.json({ brief: '' }, { status: 200 }); // Soft fail — don't block trip creation
  }
}
