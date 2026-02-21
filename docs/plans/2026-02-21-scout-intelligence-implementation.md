# Scout Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Scout from a stateless chat widget into a persistent, context-aware trip intelligence layer with full memory, proactive route suggestions, and a BEFORE/AFTER preview modal.

**Architecture:** Real road routes replace straight-line polylines (V2-D3). Four new Supabase tables store Scout's memory (messages, actions, tips, removed items). The Scout chat API gains Claude tool use to emit structured `suggest_route_change` payloads, which the UI renders as a full-screen preview modal the user can accept or dismiss while still chatting.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Anthropic SDK (`claude-sonnet-4-6`), Google Maps JavaScript API (DirectionsService, DirectionsRenderer), Supabase JS v2, React Context store.

---

## Task 1: V2-D3 — Real road routes via Directions API

**Files:**
- Modify: `components/Map.tsx`

The current implementation draws straight-line `google.maps.Polyline` between activity coordinates. Replace these with `google.maps.DirectionsService` routes so polylines follow actual roads.

**Step 1: Add a directions cache ref and DirectionsRenderer array ref**

In `Map.tsx`, after the existing `polylinesRef` and `drivingPolylinesRef` refs, add:

```typescript
// Real-road route renderers (replace straight-line polylinesRef)
const directionsRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
// Cache keyed by "lat,lng|lat,lng|..." to avoid duplicate API calls
const directionsCache = useRef<Map<string, google.maps.DirectionsResult>>(new Map());
```

**Step 2: Replace the straight-line polylines effect with a DirectionsService effect**

Find the existing `// Draw routes between activities in each day` useEffect (starts around line 228). Replace it entirely:

```typescript
// Draw real-road routes between activities in each day
useEffect(() => {
  if (!map || !trip) return;

  // Clear previous renderers
  directionsRenderersRef.current.forEach(r => r.setMap(null));
  directionsRenderersRef.current = [];

  const dayColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

  trip.days.forEach((day, index) => {
    if (!isDaySelected(day.dayNumber)) return;

    const visibleActivities = day.activities.filter(a => a.showOnMap !== false);
    if (visibleActivities.length < 2) return;

    const waypoints = visibleActivities.slice(1, -1).map(a => ({
      location: new google.maps.LatLng(a.coordinates.lat, a.coordinates.lng),
      stopover: false,
    }));

    const origin = new google.maps.LatLng(
      visibleActivities[0].coordinates.lat,
      visibleActivities[0].coordinates.lng
    );
    const destination = new google.maps.LatLng(
      visibleActivities[visibleActivities.length - 1].coordinates.lat,
      visibleActivities[visibleActivities.length - 1].coordinates.lng
    );

    const cacheKey = visibleActivities.map(a => `${a.coordinates.lat},${a.coordinates.lng}`).join('|');

    const color = dayColors[index % dayColors.length];

    const render = (result: google.maps.DirectionsResult) => {
      const renderer = new google.maps.DirectionsRenderer({
        map,
        directions: result,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: color,
          strokeOpacity: 0.7,
          strokeWeight: 3,
        },
      });
      directionsRenderersRef.current.push(renderer);
    };

    if (directionsCache.current.has(cacheKey)) {
      render(directionsCache.current.get(cacheKey)!);
      return;
    }

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsCache.current.set(cacheKey, result);
          render(result);
        }
        // On failure, silently fall back — markers still show locations
      }
    );
  });
}, [map, trip, showActivities, showDriving, showLodging, selectedDays]);
```

Also remove the old `polylinesRef` declaration and the old `polylinesRef.current.forEach(...)` cleanup, since `directionsRenderersRef` replaces it.

**Step 3: Verify build passes**

```bash
cd /c/Users/eddie.gady/Desktop/travel-planner && npm run build
```
Expected: no TypeScript errors. If you see "Property 'DirectionsRenderer' does not exist", ensure the Maps script URL includes `&libraries=places,geometry,marker` (it does — DirectionsService/Renderer are part of the core library).

**Step 4: Manual verify**
- `npm run dev`, open a trip with multiple activities on the same day
- Route polylines should now follow roads instead of straight lines
- Day filter chips should still show/hide routes correctly

**Step 5: Commit**
```bash
git add components/Map.tsx
git commit -m "feat(map): replace straight-line polylines with real road routes via DirectionsService (V2-D3)"
```

---

## Task 2: Supabase schema v2 — 4 new Scout tables

**Files:**
- Create: `supabase-schema-v2.sql`

**Step 1: Create the SQL file**

```sql
-- Scout Intelligence: Supabase Schema v2
-- Run this in Supabase Dashboard > SQL Editor > New Query

-- 1. Chat message history per trip
create table if not exists scout_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
create index if not exists idx_scout_messages_trip on scout_messages(trip_id, created_at asc);

-- 2. Applied route changes and other Scout actions
create table if not exists scout_actions (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  action_type text not null,
  description text not null,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  applied_at timestamptz default now()
);
create index if not exists idx_scout_actions_trip on scout_actions(trip_id, applied_at asc);

-- 3. Proactive tips per trip (replaces localStorage)
create table if not exists scout_tips (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  tip_key text not null,
  message text not null,
  type text not null check (type in ('warning', 'info', 'suggestion')),
  dismissed boolean default false,
  created_at timestamptz default now(),
  dismissed_at timestamptz,
  unique(trip_id, tip_key)
);
create index if not exists idx_scout_tips_trip on scout_tips(trip_id);

-- 4. Deletion log so Scout never re-recommends removed items
create table if not exists scout_removed_items (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  item_type text not null check (item_type in ('activity', 'day', 'lodging')),
  name text not null,
  reason text,
  removed_at timestamptz default now()
);
create index if not exists idx_scout_removed_trip on scout_removed_items(trip_id);

-- RLS: allow public access (same as trips table — replace with auth policies when ready)
alter table scout_messages enable row level security;
alter table scout_actions enable row level security;
alter table scout_tips enable row level security;
alter table scout_removed_items enable row level security;

create policy "Allow public read" on scout_messages for select using (true);
create policy "Allow public insert" on scout_messages for insert with check (true);
create policy "Allow public update" on scout_messages for update using (true);
create policy "Allow public delete" on scout_messages for delete using (true);

create policy "Allow public read" on scout_actions for select using (true);
create policy "Allow public insert" on scout_actions for insert with check (true);
create policy "Allow public update" on scout_actions for update using (true);
create policy "Allow public delete" on scout_actions for delete using (true);

create policy "Allow public read" on scout_tips for select using (true);
create policy "Allow public insert" on scout_tips for insert with check (true);
create policy "Allow public update" on scout_tips for update using (true);
create policy "Allow public delete" on scout_tips for delete using (true);

create policy "Allow public read" on scout_removed_items for select using (true);
create policy "Allow public insert" on scout_removed_items for insert with check (true);
create policy "Allow public update" on scout_removed_items for update using (true);
create policy "Allow public delete" on scout_removed_items for delete using (true);
```

**Step 2: User action required — run in Supabase**

> ⚠️ **STOP HERE** — the developer must paste this SQL into Supabase Dashboard > SQL Editor > New Query and click Run before continuing. Confirm all 4 tables appear in Table Editor before proceeding.

**Step 3: Commit the SQL file**
```bash
git add supabase-schema-v2.sql
git commit -m "feat(db): Scout intelligence schema — scout_messages, scout_actions, scout_tips, scout_removed_items"
```

---

## Task 3: Store mutations — logRemovedItem and applyRouteChange

**Files:**
- Modify: `lib/store.tsx`
- Modify: `lib/supabase.ts` (add Scout table helpers)

### Step 1: Add Scout Supabase helpers to `lib/supabase.ts`

Read the file first, then append these exports at the bottom:

```typescript
// ─── Scout Intelligence helpers ───────────────────────────────────────────

export async function loadScoutMessages(tripId: string) {
  const { data, error } = await supabase
    .from('scout_messages')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; role: string; content: string; created_at: string }>;
}

export async function saveScoutMessages(
  tripId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  const rows = messages.map(m => ({ trip_id: tripId, role: m.role, content: m.content }));
  const { error } = await supabase.from('scout_messages').insert(rows);
  if (error) throw error;
}

export async function loadScoutContext(tripId: string) {
  const [messagesRes, actionsRes, tipsRes, removedRes] = await Promise.all([
    supabase.from('scout_messages').select('*').eq('trip_id', tripId).order('created_at', { ascending: true }),
    supabase.from('scout_actions').select('*').eq('trip_id', tripId).order('applied_at', { ascending: true }),
    supabase.from('scout_tips').select('*').eq('trip_id', tripId).eq('dismissed', false),
    supabase.from('scout_removed_items').select('*').eq('trip_id', tripId),
  ]);
  return {
    messages: (messagesRes.data ?? []) as Array<{ role: string; content: string }>,
    actions: (actionsRes.data ?? []) as Array<{ description: string; applied_at: string }>,
    tips: (tipsRes.data ?? []) as Array<{ message: string; type: string }>,
    removedItems: (removedRes.data ?? []) as Array<{ name: string; item_type: string; reason: string | null }>,
  };
}

export async function saveScoutAction(
  tripId: string,
  actionType: string,
  description: string,
  beforeSnapshot: unknown,
  afterSnapshot: unknown
) {
  const { error } = await supabase.from('scout_actions').insert({
    trip_id: tripId,
    action_type: actionType,
    description,
    before_snapshot: beforeSnapshot,
    after_snapshot: afterSnapshot,
  });
  if (error) throw error;
}

export async function logRemovedItemToDb(
  tripId: string,
  itemType: 'activity' | 'day' | 'lodging',
  name: string,
  reason?: string
) {
  const { error } = await supabase.from('scout_removed_items').insert({
    trip_id: tripId,
    item_type: itemType,
    name,
    reason: reason ?? null,
  });
  if (error) console.error('Failed to log removed item:', error);
  // Non-throwing: removal logging is fire-and-forget
}

export async function upsertScoutTips(
  tripId: string,
  tips: Array<{ id: string; message: string; type: 'warning' | 'info' | 'suggestion' }>
) {
  const rows = tips.map(t => ({
    trip_id: tripId,
    tip_key: t.id,
    message: t.message,
    type: t.type,
    dismissed: false,
  }));
  const { error } = await supabase
    .from('scout_tips')
    .upsert(rows, { onConflict: 'trip_id,tip_key', ignoreDuplicates: true });
  if (error) console.error('Failed to upsert tips:', error);
}

export async function loadScoutTips(tripId: string) {
  const { data, error } = await supabase
    .from('scout_tips')
    .select('*')
    .eq('trip_id', tripId);
  if (error) return [];
  return (data ?? []) as Array<{ id: string; tip_key: string; message: string; type: string; dismissed: boolean }>;
}

export async function dismissScoutTip(tipId: string) {
  const { error } = await supabase
    .from('scout_tips')
    .update({ dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', tipId);
  if (error) console.error('Failed to dismiss tip:', error);
}
```

### Step 2: Add `logRemovedItem` and `applyRouteChange` to `lib/store.tsx`

Add to the `TripContextType` interface:
```typescript
logRemovedItem: (itemType: 'activity' | 'day' | 'lodging', name: string, reason?: string) => void;
applyRouteChange: (payload: RouteChangePayload) => void;
```

Add the `RouteChangePayload` type at the top of `lib/store.tsx` (after imports):
```typescript
import { logRemovedItemToDb, saveScoutAction } from './supabase';
import type { Day } from '@/types';

export interface RouteChangePayload {
  affected_day_numbers: number[];
  description: string;
  reason: string;
  new_days: Day[];
  new_end_date: string; // ISO date string
}
```

Add the implementations inside `TripProvider` (after the existing `clearTrip` callback):

```typescript
const logRemovedItem = useCallback((
  itemType: 'activity' | 'day' | 'lodging',
  name: string,
  reason?: string
) => {
  if (!trip?.id) return;
  logRemovedItemToDb(trip.id, itemType, name, reason);
}, [trip?.id]);

const applyRouteChange = useCallback((payload: RouteChangePayload) => {
  setTripState(prev => {
    if (!prev) return prev;
    const beforeSnapshot = payload.affected_day_numbers.map(n => prev.days.find(d => d.dayNumber === n));
    const newEndDate = new Date(payload.new_end_date);
    const updatedTrip = { ...prev, days: payload.new_days, endDate: newEndDate };
    const validatedDays = validateTrip(updatedTrip);
    const finalTrip = { ...updatedTrip, days: validatedDays };

    // Fire-and-forget: save action to Supabase
    saveScoutAction(
      prev.id,
      'route_change',
      payload.description,
      beforeSnapshot,
      payload.new_days
    ).catch(err => console.error('Failed to save scout action:', err));

    return finalTrip;
  });
}, []);
```

Add `logRemovedItem` and `applyRouteChange` to the context `value` object and `TripContextType`.

### Step 3: Wire `logRemovedItem` into `removeActivity`

In the existing `removeActivity` callback, before filtering the activity out, capture its name:

```typescript
const removeActivity = useCallback((activityId: string) => {
  setTripState(prev => {
    if (!prev) return prev;

    // Log the removal before filtering
    const removedActivity = prev.days.flatMap(d => d.activities).find(a => a.id === activityId);
    if (removedActivity && prev.id) {
      logRemovedItemToDb(prev.id, 'activity', removedActivity.name);
    }

    const updatedDays = prev.days.map(day => ({
      ...day,
      activities: day.activities.filter(a => a.id !== activityId),
    }));
    const tripWithUpdates = { ...prev, days: updatedDays };
    const validatedDays = validateTrip(tripWithUpdates);
    return { ...tripWithUpdates, days: validatedDays };
  });
}, []);
```

**Step 4: Build check**
```bash
npm run build
```
Expected: clean build, no TypeScript errors on new types.

**Step 5: Commit**
```bash
git add lib/store.tsx lib/supabase.ts
git commit -m "feat(store): add applyRouteChange, logRemovedItem mutations + Scout Supabase helpers"
```

---

## Task 4: Scout chat API — full memory context + tool use

**Files:**
- Modify: `app/api/scout/chat/route.ts`

Replace the entire file with the upgraded version:

```typescript
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
        description: 'Why this change is being suggested (reference the user\'s preferences)',
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

  // Load Scout memory context from Supabase (if tripId provided)
  let context: Awaited<ReturnType<typeof loadScoutContext>> = {
    messages: [], actions: [], tips: [], removedItems: [],
  };
  if (tripId) {
    try {
      context = await loadScoutContext(tripId);
    } catch (err) {
      console.error('Failed to load Scout context:', err);
      // Non-fatal: continue without persistent context
    }
  }

  const systemPrompt = buildSystemPrompt(trip, context);

  // Merge persisted history with current session messages
  // (persisted messages are already in DB; current session messages come from client)
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
          // Check for tool use blocks
          for (const block of msg.content) {
            if (block.type === 'tool_use' && block.name === 'suggest_route_change') {
              routeSuggestionPayload = block.input;
            }
          }

          // Emit route suggestion as a separate SSE event
          if (routeSuggestionPayload && !closed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'route_suggestion', payload: routeSuggestionPayload })}\n\n`
              )
            );
          }

          // Persist messages to Supabase (fire-and-forget)
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
```

**Step 2: Build check**
```bash
npm run build
```

**Step 3: Commit**
```bash
git add app/api/scout/chat/route.ts
git commit -m "feat(api): Scout chat API — full memory context, tool use for route suggestions, message persistence"
```

---

## Task 5: Scout tips API — Supabase-backed + dismiss endpoint

**Files:**
- Modify: `app/api/scout/tips/route.ts`
- Create: `app/api/scout/tips/[id]/dismiss/route.ts`

### Step 1: Update `app/api/scout/tips/route.ts`

Add `tripId` to the request body and upsert tips to Supabase:

```typescript
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

    // If we have a tripId, load existing tips from DB to avoid re-surfacing dismissed ones
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

    // Persist new tips to Supabase
    if (tripId && tips.length > 0) {
      await upsertScoutTips(tripId, tips).catch(err => console.error('Failed to upsert tips:', err));
    }

    // Filter out tips the user has already seen (by tip_key)
    const freshTips = tips.filter(t => !existingTipKeys.has(t.id));

    return NextResponse.json({ tips: freshTips });
  } catch (err) {
    console.error('Scout tips API error:', err);
    return NextResponse.json({ tips: [] });
  }
}
```

### Step 2: Create `app/api/scout/tips/[id]/dismiss/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { dismissScoutTip } from '@/lib/supabase';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dismissScoutTip(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to dismiss tip:', err);
    return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
  }
}
```

**Step 3: Build check**
```bash
npm run build
```

**Step 4: Commit**
```bash
git add app/api/scout/tips/route.ts app/api/scout/tips/[id]/dismiss/route.ts
git commit -m "feat(api): Scout tips — Supabase persistence, dedup, dismiss endpoint"
```

---

## Task 6: Sidebar — tips from Supabase, no localStorage

**Files:**
- Modify: `components/Sidebar.tsx`

### Step 1: Replace localStorage tip logic with Supabase

Replace the tip-related state and effects in `Sidebar.tsx`. The key changes:
1. Pass `tripId` to the tips API
2. Load existing tips from Supabase on mount (so dismissed state persists)
3. Dismiss calls the API endpoint instead of writing to localStorage
4. Track tips by their Supabase `id` (UUID), not the AI-generated `id`

Replace the tip state initialization and effects:

```typescript
// Replace the dismissedTipIds useState (remove localStorage initialization):
const [tips, setTips] = useState<Array<{ id: string; tip_key: string; message: string; type: 'warning' | 'info' | 'suggestion'; dismissed: boolean }>>([]);

// Replace the fetch effect:
useEffect(() => {
  if (!trip?.id) return;

  const timer = setTimeout(async () => {
    try {
      const res = await fetch('/api/scout/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip, tripId: trip.id }),
      });
      const data = await res.json() as { tips?: Array<{ id: string; message: string; type: 'warning' | 'info' | 'suggestion' }> };
      if (data.tips && data.tips.length > 0) {
        // Tips returned are already deduped against existing DB records
        setTips(data.tips.map(t => ({ ...t, tip_key: t.id, dismissed: false })));
      }
    } catch {
      // Silent fail
    }
  }, 3000);

  return () => clearTimeout(timer);
}, [trip]);

// Replace handleDismissTip:
const handleDismissTip = async (tipKey: string) => {
  // Optimistically hide the tip
  setTips(prev => prev.map(t => t.tip_key === tipKey ? { ...t, dismissed: true } : t));
  // Persist dismiss — tip_key is the AI-generated id; we use it to find the DB row
  try {
    await fetch(`/api/scout/tips/${encodeURIComponent(tipKey)}/dismiss`, { method: 'PATCH' });
  } catch { /* non-fatal */ }
};

// Update visibleTips filter:
const visibleTips = tips.filter(t => !t.dismissed);
```

Update the `<ScoutTip>` component call to pass `tip.tip_key` as the dismiss id.

**Step 2: Build check**
```bash
npm run build
```

**Step 3: Commit**
```bash
git add components/Sidebar.tsx
git commit -m "feat(sidebar): Scout tips loaded from Supabase, dismiss persisted to DB (removes localStorage)"
```

---

## Task 7: ScoutPanel — persistent history + route suggestion cards

**Files:**
- Modify: `components/ScoutPanel.tsx`

### Step 1: Load chat history from Supabase on panel open

Add a `useEffect` that loads history when `isOpen` becomes true:

```typescript
// Add to imports:
import { loadScoutMessages } from '@/lib/supabase';
import RouteChangeModal from './RouteChangeModal';
import { useTrip } from '@/lib/store';
import type { RouteChangePayload } from '@/lib/store';

// Add state:
const [pendingSuggestion, setPendingSuggestion] = useState<RouteChangePayload | null>(null);
const [showRouteModal, setShowRouteModal] = useState(false);
const [historyLoaded, setHistoryLoaded] = useState(false);

// Load chat history when panel opens (once per trip load):
useEffect(() => {
  if (!isOpen || historyLoaded || !trip?.id) return;
  loadScoutMessages(trip.id)
    .then(rows => {
      if (rows.length > 0) {
        setMessages(rows.map(r => ({ role: r.role as 'user' | 'assistant', content: r.content })));
      }
      setHistoryLoaded(true);
    })
    .catch(() => setHistoryLoaded(true)); // non-fatal
}, [isOpen, historyLoaded, trip?.id]);
```

### Step 2: Add `tripId` to the fetch call

In `sendMessage`, update the fetch body:
```typescript
body: JSON.stringify({ messages: outgoingMessages, tripContext: trip, tripId: trip?.id }),
```

### Step 3: Handle `route_suggestion` SSE events

In the SSE parsing loop, alongside the existing `text` handler, add:

```typescript
const parsed = JSON.parse(data) as { text?: string; error?: string; type?: string; payload?: RouteChangePayload };

if (parsed.type === 'route_suggestion' && parsed.payload) {
  setPendingSuggestion(parsed.payload);
  // Don't add to message content — it renders as a card below the message
  continue;
}

const chunk = parsed.text ?? parsed.error ?? '';
// ... existing chunk handling
```

### Step 4: Render suggestion card in message list

After the messages map, add a suggestion card that appears when `pendingSuggestion` is set:

```tsx
{pendingSuggestion && (
  <div className="mx-2 my-2 border border-orange-200 rounded-lg bg-orange-50 p-3">
    <p className="text-sm font-semibold text-orange-800 mb-1">🗺️ Route Change Available</p>
    <p className="text-xs text-orange-700 mb-3">{pendingSuggestion.description}</p>
    <div className="flex gap-2">
      <button
        onClick={() => setShowRouteModal(true)}
        className="flex-1 bg-orange-500 text-white text-xs py-1.5 rounded-md hover:bg-orange-600"
      >
        Preview Change
      </button>
      <button
        onClick={() => setPendingSuggestion(null)}
        className="flex-1 bg-white text-gray-600 text-xs py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
      >
        Dismiss
      </button>
    </div>
  </div>
)}
```

### Step 5: Render RouteChangeModal

At the bottom of the component return, outside the drawer:
```tsx
{showRouteModal && pendingSuggestion && (
  <RouteChangeModal
    payload={pendingSuggestion}
    onAccept={() => {
      setShowRouteModal(false);
      setPendingSuggestion(null);
    }}
    onDismiss={() => setShowRouteModal(false)}
  />
)}
```

**Step 6: Build check**
```bash
npm run build
```

**Step 7: Commit**
```bash
git add components/ScoutPanel.tsx
git commit -m "feat(scout): persistent chat history from Supabase + route suggestion card UI"
```

---

## Task 8: RouteChangeModal — BEFORE/AFTER preview with mini map

**Files:**
- Create: `components/RouteChangeModal.tsx`

```tsx
'use client';

import { useTrip, RouteChangePayload } from '@/lib/store';
import type { Day } from '@/types';
import { useEffect, useRef } from 'react';

interface RouteChangeModalProps {
  payload: RouteChangePayload;
  onAccept: () => void;
  onDismiss: () => void;
}

function DayPreviewCard({ day, label }: { day: Day; label: string }) {
  return (
    <div className="border rounded-lg p-3 bg-white">
      <p className="text-xs font-bold text-gray-500 uppercase mb-1">{label}</p>
      <p className="font-semibold text-gray-900 mb-2">Day {day.dayNumber}</p>
      <ul className="space-y-1">
        {day.activities.map(a => (
          <li key={a.id} className="text-xs text-gray-600 flex items-center gap-1">
            <span>{a.type === 'driving' ? '🚗' : a.type === 'hotel' ? '🏨' : a.type === 'camping' ? '⛺' : '📍'}</span>
            {a.name}
          </li>
        ))}
        {day.activities.length === 0 && (
          <li className="text-xs text-gray-400 italic">No activities</li>
        )}
      </ul>
    </div>
  );
}

export default function RouteChangeModal({ payload, onAccept, onDismiss }: RouteChangeModalProps) {
  const { trip, applyRouteChange } = useTrip();
  const mapRef = useRef<HTMLDivElement>(null);

  // Get affected days from current trip (BEFORE state)
  const beforeDays = payload.affected_day_numbers
    .map(n => trip?.days.find(d => d.dayNumber === n))
    .filter(Boolean) as Day[];

  // AFTER state: the affected days from the new_days payload
  const afterDays = payload.new_days.filter(d =>
    payload.affected_day_numbers.includes(d.dayNumber) ||
    // Also include any new days inserted between affected day numbers
    (d.dayNumber > Math.min(...payload.affected_day_numbers) &&
     d.dayNumber <= Math.max(...payload.affected_day_numbers) + 1)
  );

  // Mini map: draw before (orange) and after (green) routes
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 6,
      center: { lat: 39.8283, lng: -98.5795 },
      disableDefaultUI: true,
      gestureHandling: 'none',
    });

    const allCoords = [
      ...beforeDays.flatMap(d => d.activities.map(a => a.coordinates)),
      ...afterDays.flatMap(d => d.activities.map(a => a.coordinates)),
    ];

    if (allCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allCoords.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, 40);
    }

    // Draw before route (orange, dashed)
    if (beforeDays.length > 0) {
      const coords = beforeDays.flatMap(d => d.activities.map(a => a.coordinates));
      new google.maps.Polyline({
        path: coords,
        strokeColor: '#f97316',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map,
      });
    }

    // Draw after route (green)
    if (afterDays.length > 0) {
      const coords = afterDays.flatMap(d => d.activities.map(a => a.coordinates));
      new google.maps.Polyline({
        path: coords,
        strokeColor: '#10b981',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map,
      });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccept = () => {
    applyRouteChange(payload);
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">🗺️ Route Change Preview</h2>
            <p className="text-sm text-gray-500 mt-0.5">{payload.reason}</p>
          </div>
          <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Mini map */}
        <div ref={mapRef} className="w-full h-48 bg-gray-100" />

        {/* Map legend */}
        <div className="px-6 py-2 flex items-center gap-4 text-xs text-gray-500 bg-gray-50 border-b">
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-1 bg-orange-500 rounded" /> Current route</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-1 bg-emerald-500 rounded" /> Proposed route</span>
        </div>

        {/* BEFORE / AFTER day cards */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Before</p>
              <div className="space-y-2">
                {beforeDays.map(d => (
                  <DayPreviewCard key={d.dayNumber} day={d} label={`Day ${d.dayNumber}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase mb-2">After</p>
              <div className="space-y-2">
                {afterDays.map(d => (
                  <DayPreviewCard key={d.dayNumber} day={d} label={`Day ${d.dayNumber}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 bg-emerald-500 text-white py-2.5 rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
          >
            Accept Change
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 bg-white text-gray-700 py-2.5 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Build check**
```bash
npm run build
```

**Step 3: Manual test**
- Open Scout, send: "Day 3 has a very long drive, can you suggest a better split?"
- Scout should respond with text + a "Preview Change" card appears in the chat
- Click Preview → modal opens with BEFORE/AFTER cards and mini map
- Accept → trip days update in the sidebar, modal closes

**Step 4: Commit**
```bash
git add components/RouteChangeModal.tsx
git commit -m "feat(scout): RouteChangeModal — full-screen BEFORE/AFTER preview with mini map"
```

---

## Task 9: Dashboard modal with gas cost estimator

**Files:**
- Create: `components/DashboardModal.tsx`
- Modify: `app/page.tsx` (wire modal to existing Dashboard button in TopNav)

### Step 1: Create `components/DashboardModal.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useTrip } from '@/lib/store';

interface DashboardModalProps {
  onClose: () => void;
}

export default function DashboardModal({ onClose }: DashboardModalProps) {
  const { trip } = useTrip();
  const [mpg, setMpg] = useState(25);
  const [gasPrice, setGasPrice] = useState(3.50);

  if (!trip) return null;

  const totalMiles = trip.totalDistance ?? 0;
  const estimatedGallons = totalMiles > 0 ? totalMiles / mpg : 0;
  const estimatedCost = estimatedGallons * gasPrice;

  const totalDays = trip.days.length;
  const drivingDays = trip.days.filter(d => d.activities.some(a => a.type === 'driving')).length;
  const campingNights = trip.days.filter(d => d.lodging === 'camping').length;
  const hotelNights = trip.days.filter(d => d.lodging === 'hotel').length;
  const dogFriendlyDays = trip.days.filter(d => d.activities.every(a => a.isDogFriendly !== false)).length;

  const validationErrors = trip.days.flatMap(d => d.validationStatus.messages.filter(m => m.level === 'error'));
  const validationWarnings = trip.days.flatMap(d => d.validationStatus.messages.filter(m => m.level === 'warning'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">📊 Trip Dashboard</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Trip overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalDays}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Days</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{drivingDays}</p>
              <p className="text-xs text-gray-500 mt-0.5">Driving Days</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalMiles > 0 ? Math.round(totalMiles).toLocaleString() : '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Est. Miles</p>
            </div>
          </div>

          {/* Gas cost estimator */}
          <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
            <p className="font-semibold text-orange-900 mb-3">⛽ Gas Cost Estimator</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Vehicle MPG</label>
                <input
                  type="number"
                  min={1}
                  max={150}
                  value={mpg}
                  onChange={e => setMpg(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Gas Price ($/gal)</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={gasPrice}
                  onChange={e => setGasPrice(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            {totalMiles > 0 ? (
              <div className="bg-white rounded-md p-3 text-center">
                <p className="text-3xl font-bold text-orange-600">${estimatedCost.toFixed(0)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {Math.round(totalMiles).toLocaleString()} mi ÷ {mpg} MPG × ${gasPrice.toFixed(2)}/gal
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-2">Total distance not yet calculated. Add activities with real road routes to estimate.</p>
            )}
          </div>

          {/* Lodging summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">🏨 Lodging</p>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between"><span>Hotel nights</span><span className="font-medium">{hotelNights}</span></div>
                <div className="flex justify-between"><span>Camping nights</span><span className="font-medium">{campingNights}</span></div>
              </div>
            </div>
            {trip.hasDog && (
              <div className="border rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">🐕 Dog Status</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Dog-friendly days</span><span className="font-medium">{dogFriendlyDays}/{totalDays}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Validation summary */}
          {(validationErrors.length > 0 || validationWarnings.length > 0) && (
            <div className="border rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">⚠️ Validation</p>
              <div className="space-y-1">
                {validationErrors.map((m, i) => (
                  <p key={i} className="text-xs text-red-600">🔴 {m.message}</p>
                ))}
                {validationWarnings.map((m, i) => (
                  <p key={i} className="text-xs text-yellow-700">🟡 {m.message}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Wire Dashboard button in `app/page.tsx`

Find the `<TopNav>` usage in `app/page.tsx`. The `onDashboard` prop is already wired — just ensure it sets a `showDashboard` state to `true`, and render `<DashboardModal>` when true.

Look for the existing `showDashboard` state (added in V2-A1). If it exists, just add the import and render:

```tsx
import DashboardModal from '@/components/DashboardModal';

// In the return JSX, alongside other modals:
{showDashboard && <DashboardModal onClose={() => setShowDashboard(false)} />}
```

**Step 3: Build check**
```bash
npm run build
```

**Step 4: Commit**
```bash
git add components/DashboardModal.tsx app/page.tsx
git commit -m "feat(dashboard): DashboardModal with gas cost estimator, lodging summary, validation overview (V2-F1/F2)"
```

---

## Task 10: UX Polish — Add Day button

**Files:**
- Modify: `components/Sidebar.tsx`
- Modify: `lib/store.tsx`

### Step 1: Add `addDay` to the store

In `lib/store.tsx`, add to `TripContextType`:
```typescript
addDay: () => void;
```

Add the implementation inside `TripProvider`:
```typescript
const addDay = useCallback(() => {
  setTripState(prev => {
    if (!prev) return prev;
    const nextDayNumber = prev.days.length + 1;
    // Calculate new day's date based on startDate + offset
    const newDate = prev.startDate
      ? new Date(new Date(prev.startDate).getTime() + (nextDayNumber - 1) * 86400000)
      : undefined;
    const newDay = {
      dayNumber: nextDayNumber,
      date: newDate,
      activities: [],
      validationStatus: { level: 'success' as const, messages: [] },
    };
    const updatedTrip = { ...prev, days: [...prev.days, newDay] };
    // Update endDate
    if (newDate) updatedTrip.endDate = newDate;
    const validatedDays = validateTrip(updatedTrip);
    return { ...updatedTrip, days: validatedDays };
  });
}, []);
```

Add `addDay` to the context value.

### Step 2: Add "Add Day" button to Sidebar

In `components/Sidebar.tsx`, import `addDay` from the store and add a button at the bottom of the day list:

```tsx
const { trip, addDay, selectedDay, setSelectedDay } = useTrip();

// At the bottom of the day list, before the closing div:
<button
  onClick={addDay}
  className="w-full mt-2 py-2 text-sm text-orange-600 border border-dashed border-orange-300 rounded-lg hover:bg-orange-50 transition-colors flex items-center justify-center gap-1"
>
  + Add Day
</button>
```

**Step 3: Build check + commit**
```bash
npm run build
git add components/Sidebar.tsx lib/store.tsx
git commit -m "feat(sidebar): Add Day button — extend trip by one day from sidebar"
```

---

## Task 11: UX Polish — Import confirmation screen

**Files:**
- Modify: `components/ImportItinerary.tsx`

### Step 1: Add a confirmation step after successful import

The current flow pastes text → AI parses → trip is set immediately. Add an intermediate step that shows what the AI found before applying it.

In `ImportItinerary.tsx`, add state:
```typescript
const [parsedTrip, setParsedTrip] = useState<Trip | null>(null);
const [showConfirmation, setShowConfirmation] = useState(false);
```

After the API call succeeds and returns a trip, instead of calling `setTrip(result)` directly:
```typescript
setParsedTrip(result);
setShowConfirmation(true);
```

Add a confirmation view that shows when `showConfirmation` is true:
```tsx
{showConfirmation && parsedTrip && (
  <div className="space-y-4">
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <p className="font-semibold text-green-800 mb-2">✅ Found your trip!</p>
      <p className="text-sm text-green-700">{parsedTrip.name}</p>
      <p className="text-sm text-green-600">{parsedTrip.days.length} days · {parsedTrip.days.flatMap(d => d.activities).length} activities</p>
    </div>
    <div className="space-y-1 max-h-40 overflow-y-auto">
      {parsedTrip.days.map(day => (
        <div key={day.dayNumber} className="text-xs text-gray-600 flex items-start gap-2">
          <span className="font-medium text-gray-800 w-12 flex-shrink-0">Day {day.dayNumber}</span>
          <span>{day.activities.map(a => a.name).join(', ') || 'No activities'}</span>
        </div>
      ))}
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => { setTrip(parsedTrip); onClose(); }}
        className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
      >
        Use This Trip
      </button>
      <button
        onClick={() => { setShowConfirmation(false); setParsedTrip(null); }}
        className="flex-1 bg-white text-gray-700 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50"
      >
        Try Again
      </button>
    </div>
  </div>
)}
```

**Step 2: Build check + commit**
```bash
npm run build
git add components/ImportItinerary.tsx
git commit -m "feat(import): add confirmation screen showing parsed trip before applying — fixes silent import UX"
```

---

## Final: Update backlog and status.json

After all tasks above are complete, update `docs/BACKLOG.md` and `status.json` to reflect:
- V2-D3, V2-B1, V2-B2 (upgraded), V2-B3 (upgraded), V2-B4 (upgraded), V2-B5 (upgraded) → all ✅
- V2-F1, V2-F2 → ✅
- New tasks → ✅

```bash
git add docs/BACKLOG.md status.json
git commit -m "docs: update backlog and status — Scout intelligence sprint complete"
```
