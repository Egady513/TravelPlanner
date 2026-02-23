import Anthropic from '@anthropic-ai/sdk';
import type { Trip } from '@/types';
import { loadScoutContext, saveScoutMessages } from '@/lib/supabase';

const client = new Anthropic();

const SUGGEST_ROUTE_CHANGE_TOOL: Anthropic.Tool = {
  name: 'suggest_route_change',
  description:
    'Propose a concrete change to the trip itinerary (split a long drive, add a stop, reorder days). ' +
    'Only call this when you have a specific, actionable suggestion ready to show as a preview. ' +
    'Do not call for general advice. Return the COMPLETE new days array for the entire trip, not just affected days.',
  input_schema: {
    type: 'object' as const,
    properties: {
      affected_day_numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Day numbers that change (e.g. [3] when splitting Day 3)',
      },
      description: {
        type: 'string',
        description: 'Human-readable description shown in the preview modal',
      },
      reason: {
        type: 'string',
        description: 'Why this change is being suggested (reference the user preferences)',
      },
      new_days: {
        type: 'array',
        description: 'The complete restructured days array for the entire trip',
      },
      new_end_date: {
        type: 'string',
        description: 'ISO date string of the new trip end date (may shift if days are added)',
      },
    },
    required: ['affected_day_numbers', 'description', 'reason', 'new_days', 'new_end_date'],
  },
};

function buildSystemPrompt(trip: Trip, context: Awaited<ReturnType<typeof loadScoutContext>>): string {
  const removedSection = context.removedItems.length > 0
    ? `\nPREVIOUSLY REMOVED ITEMS (do NOT re-suggest these):\n${context.removedItems
        .map(i => `- ${i.name} (${i.item_type}${i.reason ? ': ' + i.reason : ''})`)
        .join('\n')}`
    : '';

  const actionsSection = context.actions.length > 0
    ? `\nCHANGES YOU HAVE APPLIED:\n${context.actions
        .map(a => `- ${a.description} (${new Date(a.applied_at).toLocaleDateString()})`)
        .join('\n')}`
    : '';

  const tipsSection = context.tips.length > 0
    ? `\nACTIVE TIPS YOU HAVE ALREADY FLAGGED (do not repeat these):\n${context.tips
        .map(t => `- ${t.message}`)
        .join('\n')}`
    : '';

  // Build a human-readable trip summary for Scout to reference
  const tripSummary = trip.days.map(day => {
    const drives = day.activities.filter(a => a.type === 'driving');
    const driveInfo = drives.map(d => {
      const drive = d as { startLocation?: { name: string }; endLocation?: { name: string }; estimatedDriveHours?: number };
      const hrs = drive.estimatedDriveHours ? ` (~${drive.estimatedDriveHours}h)` : '';
      return `${drive.startLocation?.name ?? '?'} → ${drive.endLocation?.name ?? '?'}${hrs}`;
    }).join(', ');
    const activities = day.activities.filter(a => a.type !== 'driving').map(a => a.name).join(', ');
    return `Day ${day.dayNumber}: ${driveInfo ? `Drive ${driveInfo}` : ''}${driveInfo && activities ? ' | ' : ''}${activities || (drives.length === 0 ? 'empty' : '')}`;
  }).join('\n');

  return `You are Scout 🐾 — a warm, sharp road trip co-pilot. You talk like a knowledgeable friend who's done a lot of road trips, not a chatbot. Keep responses SHORT (2–4 sentences max unless listing items). Use plain language. Reference specific days, names, and locations from the plan. Use emoji sparingly — only where it adds clarity (🚗 for drives, ⚠️ for warnings, ✅ for good stuff).

RESPONSE STYLE:
- Short, direct sentences. No walls of text.
- Lead with the most important thing first.
- If giving multiple points, use a brief bullet list (3 items max).
- Never say "I'd be happy to" or "Great question!" — just answer.
- When you notice a problem, name it clearly and offer to fix it.

ROUTE CHANGE RULE: If a drive in the plan exceeds ${trip.maxDrivingHours}h (the user's max), you MUST proactively call suggest_route_change to offer a concrete split — even if the user didn't ask. Write 1–2 sentences explaining why first, then call the tool.

USER PREFERENCES:
- Max driving/day: ${trip.maxDrivingHours}h | Pace: ${trip.tripPace} | Dog: ${trip.hasDog ? 'yes 🐕' : 'no'} | Budget: ${trip.budgetStyle} | Lodging: ${trip.lodgingPreferences?.join(', ') || 'flexible'} | People: ${trip.peopleCount}

TRIP AT A GLANCE:
${tripSummary}

FULL TRIP DATA (for calculations):
${JSON.stringify(trip, null, 2)}
${removedSection}${actionsSection}${tipsSection}`;
}

export async function POST(request: Request) {
  let body: {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    tripContext?: Trip;
    tripId?: string;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { messages, tripContext: trip, tripId } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400 });
  }
  if (!trip) {
    return new Response(JSON.stringify({ error: 'tripContext required' }), { status: 400 });
  }

  let context: Awaited<ReturnType<typeof loadScoutContext>> = {
    messages: [], actions: [], tips: [], removedItems: [],
  };
  if (tripId) {
    try {
      context = await loadScoutContext(tripId);
    } catch (err) {
      console.error('Failed to load Scout context:', err);
    }
  }

  const systemPrompt = buildSystemPrompt(trip, context);
  const allMessages = messages as Array<{ role: 'user' | 'assistant'; content: string }>;

  const encoder = new TextEncoder();
  let routeSuggestionPayload: unknown = null;
  let assistantText = '';
  const userMessage = allMessages[allMessages.length - 1];

  const readableStream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          tools: [SUGGEST_ROUTE_CHANGE_TOOL],
          messages: allMessages,
        });

        stream.on('text', (text) => {
          assistantText += text;
          if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        });

        stream.on('message', async (msg) => {
          for (const block of msg.content) {
            if (block.type === 'tool_use' && block.name === 'suggest_route_change') {
              routeSuggestionPayload = block.input;
            }
          }

          if (routeSuggestionPayload && !closed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'route_suggestion', payload: routeSuggestionPayload })}\n\n`
              )
            );
          }

          if (tripId && userMessage && assistantText) {
            saveScoutMessages(tripId, [
              { role: 'user', content: userMessage.content },
              { role: 'assistant', content: assistantText },
            ]).catch(err => console.error('Failed to save Scout messages:', err));
          }

          if (!closed) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            close();
          }
        });

        stream.on('error', (err) => {
          if (!closed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
            close();
          }
        });
      } catch (err) {
        if (!closed) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          close();
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
