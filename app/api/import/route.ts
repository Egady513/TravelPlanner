import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a travel itinerary parser. Given raw trip notes or a pasted spreadsheet, extract a structured trip plan.

Return ONLY valid JSON with this exact shape:
{
  "tripName": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "hasDog": boolean,
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "name": "string (place name, specific enough to geocode)",
          "type": "trail" | "hotel" | "restaurant" | "camping" | "park",
          "isDogFriendly": boolean,
          "notes": "string or null"
        }
      ]
    }
  ]
}

Rules:
- dayNumber starts at 1
- Infer type from context: hotels/motels/airbnb → "hotel", hikes/trails → "trail", campgrounds/dispersed → "camping", restaurants/cafes → "restaurant", national parks/state parks → "park"
- isDogFriendly: default true unless context suggests otherwise (e.g., "no pets", "Angels Landing" - known no-dog trail)
- Place names must be specific enough to geocode (include city/state/park name)
- If you cannot determine a date, distribute days evenly from startDate
- hasDog: true if dog is mentioned anywhere`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { text?: unknown };
    const text = body.text;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide itinerary text (minimum 10 characters)' },
        { status: 400 }
      );
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Parse this itinerary into the structured JSON format:\n\n${text}`,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response from AI' }, { status: 500 });
    }

    // Extract JSON from the response (handle markdown code blocks)
    const raw = content.text;
    const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) ?? raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;

    const parsed: unknown = JSON.parse(jsonStr);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse itinerary';
    console.error('Import API error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
