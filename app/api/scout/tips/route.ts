import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { Trip } from '@/types';
import { upsertScoutTips, loadScoutTips } from '@/lib/supabase';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are Scout, a road trip planning assistant. Analyze the trip and provide 2-4 concise, actionable tips. Return ONLY a JSON array of tip objects: [{"id":"tip-1","message":"...","type":"warning|info|suggestion"}]. No markdown, no prose, just the JSON array.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { trip?: unknown; tripId?: string };
    const trip = body.trip as Trip | undefined;
    const tripId = body.tripId as string | undefined;

    if (!trip) {
      return NextResponse.json({ error: 'trip required' }, { status: 400 });
    }

    let existingTipKeys = new Set<string>();
    if (tripId) {
      try {
        const existing = await loadScoutTips(tripId);
        existingTipKeys = new Set(existing.map(t => t.tip_key));
      } catch { /* non-fatal */ }
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Trip plan: ${JSON.stringify(trip, null, 2)}` }],
    });

    const content = message.content[0];
    if (!content || content.type !== 'text') return NextResponse.json({ tips: [] });

    let tips: Array<{ id: string; message: string; type: 'warning' | 'info' | 'suggestion' }> = [];
    try {
      tips = JSON.parse(content.text);
    } catch (parseErr) {
      console.error('Scout tips: JSON parse failure', parseErr);
      return NextResponse.json({ tips: [] });
    }

    if (tripId && tips.length > 0) {
      await upsertScoutTips(tripId, tips).catch(err => console.error('Failed to upsert tips:', err));
    }

    const freshTips = tips.filter(t => !existingTipKeys.has(t.id));

    return NextResponse.json({ tips: freshTips });
  } catch (err) {
    console.error('Scout tips API error:', err);
    return NextResponse.json({ tips: [] });
  }
}
