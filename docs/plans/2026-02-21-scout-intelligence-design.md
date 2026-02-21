# Scout Intelligence — Design Doc
**Date:** 2026-02-21
**Status:** Approved
**Priority order:** V2-D3 → Scout Memory → Route Suggestions → Dashboard → UX Polish

---

## Overview

Scout is the primary differentiator of this app. This design elevates Scout from a stateless chat widget into a persistent, context-aware trip intelligence layer that:
- Remembers every conversation across sessions
- Knows what was removed from the itinerary and why
- Proactively detects problems (long drives, dog-unfriendly stops, etc.)
- Suggests concrete route changes the user can preview and accept with one click
- Cascades approved changes through the full itinerary automatically

---

## Priority Order

| # | Task | Dependency |
|---|------|------------|
| 1 | V2-D3 — Real road routes via Directions API | None — unblocks accurate drive times for Scout |
| 2 | Scout Memory — 4 Supabase tables + API upgrade | V2-D3 preferred first |
| 3 | Route Suggestions — tool use + RouteChangeModal | Scout Memory |
| 4 | V2-F1/F2 — Dashboard + gas cost estimator | V2-D3 (needs real distances) |
| 5 | UX Polish — Add Day button, import confirmation, etc. | None |

---

## Section 1: Data Layer

### New Supabase Tables

**`scout_messages`** — persistent chat history per trip
```sql
create table scout_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
create index idx_scout_messages_trip on scout_messages(trip_id, created_at asc);
```

**`scout_actions`** — log of every change Scout applied to the trip
```sql
create table scout_actions (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  action_type text not null,        -- 'route_change' | 'day_added' | etc.
  description text not null,        -- "Split Day 3 into two legs via Flagstaff"
  before_snapshot jsonb not null,   -- affected Day(s) before change
  after_snapshot jsonb not null,    -- affected Day(s) after change
  applied_at timestamptz default now()
);
create index idx_scout_actions_trip on scout_actions(trip_id, applied_at asc);
```

**`scout_tips`** — proactive tips stored per trip (replaces localStorage)
```sql
create table scout_tips (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  tip_key text not null,            -- stable hash of message content (dedup)
  message text not null,
  type text not null check (type in ('warning', 'info', 'suggestion')),
  dismissed boolean default false,
  created_at timestamptz default now(),
  dismissed_at timestamptz,
  unique(trip_id, tip_key)
);
```

**`scout_removed_items`** — deletion log so Scout never re-recommends removed items
```sql
create table scout_removed_items (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references trips(id) on delete cascade,
  item_type text not null,          -- 'activity' | 'day' | 'lodging'
  name text not null,               -- "Grand Canyon National Park"
  reason text,                      -- optional: "already visited", "too far", null
  removed_at timestamptz default now()
);
create index idx_scout_removed_trip on scout_removed_items(trip_id);
```

All four tables use the same public RLS policies as `trips` (allow all via anon key until auth is added).

### What Scout Sees Every Session

Scout's system prompt is assembled from:
1. **Full `Trip` object** — includes all wizard presets (maxDrivingHours, tripPace, hasDog, budget, lodgingPreferences) + complete current itinerary (all days, activities, lodging, camping)
2. **All `scout_messages`** for this trip — no arbitrary cap; full conversation history
3. **All `scout_actions`** — summary of every change Scout applied, with before/after context
4. **Non-dismissed `scout_tips`** — so Scout doesn't repeat active tips
5. **All `scout_removed_items`** — so Scout never re-recommends deleted activities or stops

---

## Section 2: Scout Memory API

### `POST /api/scout/chat` — upgraded

**Request:**
```json
{
  "messages": [...],         // current session messages (not yet in DB)
  "tripContext": { ...Trip },
  "tripId": "abc-123"        // new — keys all Supabase lookups
}
```

**On every request (parallel Supabase fetches):**
1. Load all `scout_messages` for `trip_id`
2. Load all `scout_actions` for `trip_id`
3. Load non-dismissed `scout_tips` for `trip_id`
4. Load all `scout_removed_items` for `trip_id`

**System prompt assembly:**
```
You are Scout, a friendly road trip planning assistant...

TRIP PLAN (current state):
${JSON.stringify(tripContext)}

USER PREFERENCES (from trip setup):
- Max driving per day: ${trip.maxDrivingHours}h
- Trip pace: ${trip.tripPace}
- Traveling with dog: ${trip.hasDog}
- Budget style: ${trip.budgetStyle}
- Lodging: ${trip.lodgingPreferences.join(', ')}

PREVIOUSLY REMOVED ITEMS (do not re-suggest these):
${removedItems.map(i => `- ${i.name} (${i.item_type}${i.reason ? ': ' + i.reason : ''})`).join('\n')}

CHANGES YOU HAVE APPLIED:
${actions.map(a => `- ${a.description} (${a.applied_at})`).join('\n')}

ACTIVE TIPS YOU HAVE ALREADY FLAGGED:
${tips.map(t => `- ${t.message}`).join('\n')}
```

**Tool definition — `suggest_route_change`:**
```json
{
  "name": "suggest_route_change",
  "description": "Propose a concrete change to the trip itinerary. Only call this when you have a specific, actionable suggestion ready to preview. Do not call for general advice.",
  "input_schema": {
    "type": "object",
    "properties": {
      "affected_day_numbers": { "type": "array", "items": { "type": "number" } },
      "description": { "type": "string" },
      "reason": { "type": "string" },
      "new_days": { "type": "array", "description": "Complete restructured days array for the entire trip" },
      "new_end_date": { "type": "string", "format": "date" }
    },
    "required": ["affected_day_numbers", "description", "reason", "new_days", "new_end_date"]
  }
}
```

**SSE event types returned by the API:**
- `data: {"text": "..."}` — streaming text chunk (existing)
- `data: {"type": "route_suggestion", "payload": {...}}` — structured suggestion (new)
- `data: [DONE]` — stream complete (existing)

**After stream completes:**
- Save user message to `scout_messages`
- Save assistant message to `scout_messages`

### `POST /api/scout/tips` — upgraded

- Accepts `tripId` in addition to `trip`
- Checks existing `scout_tips` for this trip — skips tips already seen
- Upserts new tips to `scout_tips` (on conflict `trip_id, tip_key` do nothing)
- Returns tips array as before (UI behavior unchanged)
- Dismiss action now calls `PATCH /api/scout/tips/[id]/dismiss` → sets `dismissed: true` in Supabase

---

## Section 3: Route Suggestion Flow

```
1. Scout detects drive > maxDrivingHours (using real road times after V2-D3)

2. Scout streams explanation text + calls suggest_route_change tool:
   "Day 3 is a 9-hour drive — over your 6h preference. I'd split it
    with a stop in Flagstaff. Here's what that looks like:"
   [Preview Route Change]  [Tell me more]

3a. User clicks [Tell me more] → conversation continues, no modal
    User can ask "what about Sedona instead?" → Scout generates new suggestion
    New [Preview] button appears for the revised suggestion

3b. User clicks [Preview Route Change] → RouteChangeModal opens
    Scout chat panel remains accessible behind the modal

4. RouteChangeModal displays:
   BEFORE                         AFTER
   ─────────────────────────      ─────────────────────────
   Day 3: Phoenix → Las Vegas     Day 3: Phoenix → Flagstaff
   🚗 9h 10min · 283mi            🚗 2h 20min · 145mi

   Day 4: (unchanged)             Day 4: Flagstaff → Las Vegas
                                  🚗 2h 30min · 157mi

   Mini map: current route (orange) vs proposed route (green)

   [Accept Change]  [Dismiss]

5a. User accepts:
    - trip.days replaced with new_days (all days renumbered, dates shifted)
    - trip.endDate updated to new_end_date
    - scout_actions row written (before/after snapshots)
    - Trip saved to Supabase
    - Validation re-runs on all days
    - Modal closes
    - Scout: "Done! Day 3 is now two comfortable legs."

5b. User dismisses:
    - Modal closes
    - Scout context records suggestion was dismissed
    - Scout won't re-suggest same split (but can suggest alternatives)

6. Future session: "What was Day 3 originally?"
   Scout reads scout_actions.before_snapshot → answers from memory
```

---

## Section 4: UI Components

### Modified: `ScoutPanel.tsx`
- On open: load all `scout_messages` for `trip_id` from Supabase, populate history
- On send: after stream completes, save both messages to Supabase
- SSE parser: handles `{"type":"route_suggestion"}` event → renders suggestion card with [Preview] + [Tell me more] buttons
- Suggestion card is inline in the message thread, persists across sessions

### Modified: `Sidebar.tsx` / Scout tips
- Load tips from `scout_tips` Supabase table on trip load
- Dismiss writes to Supabase, not localStorage
- No visual change for user

### New: `RouteChangeModal.tsx`
- Full-screen overlay, z-index above map/sidebar but Scout panel accessible
- Two-column layout: BEFORE days (left) vs AFTER days (right)
- Day cards show: day number, drive time, key activities
- Mini Google Map embedded: renders both route polylines
- [Accept Change] → calls `store.applyRouteChange(payload)`
- [Dismiss] → closes modal, returns focus to Scout chat

### Modified: `lib/store.tsx`
- `applyRouteChange(payload)` — replaces trip.days, updates endDate, saves to Supabase, writes scout_action
- `logRemovedItem(item)` — called on every activity/day/lodging delete, writes to `scout_removed_items`
- Both functions are fire-and-forget (no loading state needed)

### New: `supabase-schema-v2.sql`
- Contains all 4 new table definitions with indexes and RLS policies
- User runs this once in Supabase SQL Editor

---

## What Scout Knows (Full Summary)

| Data | Source | How it enters Scout |
|------|--------|-------------------|
| Full itinerary (days, activities, lodging, camping) | `trips` table JSONB | `tripContext` in system prompt |
| Wizard presets (maxDrivingHours, pace, dog, budget) | `trips` table flat columns | `tripContext` in system prompt |
| Chat history | `scout_messages` | Loaded and injected into messages array |
| Applied route changes | `scout_actions` | Summarized in system prompt |
| Active tips | `scout_tips` | Listed in system prompt |
| Deleted activities/stops | `scout_removed_items` | Listed in system prompt as "do not suggest" |
| Location knowledge | Claude training data | Inherent — no extra API needed |
