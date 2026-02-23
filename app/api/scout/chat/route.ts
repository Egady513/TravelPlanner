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

  return `You are Scout, a friendly and knowledgeable road trip planning assistant. You have full context of the user's trip below. Be concise but helpful. Reference specific days, activities, and locations from their plan when relevant.

When you detect a drive that exceeds the user's maxDrivingHours preference, proactively use the suggest_route_change tool to offer a concrete split. Always explain your reasoning first in plain text, then call the tool.

USER PREFERENCES (set during trip setup):
- Max driving per day: ${trip.maxDrivingHours}h
- Trip pace: ${trip.tripPace}
- Traveling with dog: ${trip.hasDog}
- Budget style: ${trip.budgetStyle}
- Lodging preferences: ${trip.lodgingPreferences?.join(', ') || 'flexible'}
- People: ${trip.peopleCount}

FULL TRIP ITINERARY (current state):
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
