import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { Trip } from '@/types';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are Scout, a road trip planning assistant. Analyze the trip and provide 2-4 concise, actionable tips. Return ONLY a JSON array of tip objects with this exact shape: [{"id":"tip-1","message":"...","type":"warning|info|suggestion"}]. No markdown, no prose, just the JSON array.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { trip?: unknown };
    const trip = body.trip as Trip | undefined;

    if (!trip) {
      return NextResponse.json(
        { error: 'Please provide a trip object' },
        { status: 400 }
      );
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the trip plan: ${JSON.stringify(trip, null, 2)}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ tips: [] });
    }

    let tips: Array<{ id: string; message: string; type: 'warning' | 'info' | 'suggestion' }> = [];
    try {
      tips = JSON.parse(content.text);
    } catch {
      return NextResponse.json({ tips: [] });
    }

    return NextResponse.json({ tips });
  } catch (err) {
    console.error('Scout tips API error:', err);
    return NextResponse.json({ tips: [] });
  }
}
