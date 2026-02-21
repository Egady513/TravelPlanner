import Anthropic from '@anthropic-ai/sdk';
import type { Trip } from '@/types';

const client = new Anthropic();

export async function POST(request: Request) {
  let body: { messages?: Array<{ role: 'user' | 'assistant'; content: string }>; tripContext?: Trip };
  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { messages, tripContext } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Please provide a messages array' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!tripContext) {
    return new Response(
      JSON.stringify({ error: 'Please provide a tripContext object' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const systemPrompt = `You are Scout, a friendly and knowledgeable road trip planning assistant. You have access to the user's full trip plan below. Help them plan, optimize, and enjoy their road trip. Be concise but helpful. Reference specific days, activities, and locations from their plan when relevant.

Trip Plan:
${JSON.stringify(tripContext, null, 2)}`;

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      let closed = false;

      stream.on('text', (text) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      });

      stream.on('message', () => {
        if (!closed) {
          closed = true;
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      stream.on('error', (err) => {
        if (!closed) {
          closed = true;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
          controller.close();
        }
      });
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
