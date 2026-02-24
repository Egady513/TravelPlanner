# V3 Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-night stay auto-populate, activity type map icons, AI optimize/recommend/plan-day tools to DayDetailPanel.

**Architecture:** Three dedicated JSON API routes (`/api/scout/optimize-day`, `/api/scout/recommend-activities`, `/api/scout/plan-day`) using Haiku for speed + structured output. Map switches from legacy `google.maps.Marker` to `AdvancedMarkerElement` with emoji HTML. Multi-night stays fan out copies via `addActivity` and cascade-delete via `removeActivity`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, React Context (`lib/store.tsx`), Anthropic SDK (`claude-haiku-4-5-20251001`), Google Maps JS API (`AdvancedMarkerElement`), existing `geocodePlace` in `lib/geocoding.ts`.

**Verification:** No test suite. After every task run `npx tsc --noEmit`. Before each commit run `npm run build`. Dev server: `npm run dev`.

---

### Task V3-1: Data model — continuing stay fields on Activity

**Files:**
- Modify: `types/index.ts`

**Step 1: Add three optional fields to the base `Activity` interface**

In `types/index.ts`, add to the `Activity` interface after `ticketsPurchased?`:

```typescript
export interface Activity {
  id: string;
  type: ActivityType;
  name: string;
  coordinates: Coordinates;
  dayNumber: number;
  isDogFriendly: boolean;
  notes?: string;
  showOnMap?: boolean;
  requiresTickets?: boolean;
  ticketsPurchased?: boolean;
  // Multi-night stay support
  isContinuingStay?: boolean;
  sourceActivityId?: string;
  parentDayNumber?: number;
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(v3): add continuing stay fields to Activity type (V3-1)"
```

---

### Task V3-2: Store — multi-night fanout + cascade delete

**Files:**
- Modify: `lib/store.tsx` (addActivity lines 84–97, removeActivity lines 99–114)

**Step 1: Replace `addActivity` with multi-night fanout version**

Replace the entire `addActivity` callback:

```typescript
const addActivity = useCallback((activity: Activity) => {
  setTripState(prev => {
    if (!prev) return prev;
    const nights = (activity as { nights?: number }).nights ?? 1;
    const isLodging = activity.type === 'hotel' || activity.type === 'camping';

    // Build continuing stay copies for multi-night lodging
    const continuingStays: Activity[] = [];
    if (isLodging && nights > 1) {
      for (let n = 1; n < nights; n++) {
        const targetDayNumber = activity.dayNumber + n;
        if (prev.days.some(d => d.dayNumber === targetDayNumber)) {
          continuingStays.push({
            ...activity,
            id: crypto.randomUUID(),
            dayNumber: targetDayNumber,
            isContinuingStay: true,
            sourceActivityId: activity.id,
            parentDayNumber: activity.dayNumber,
          });
        }
      }
    }

    const allToAdd = [activity, ...continuingStays];
    const updatedDays = prev.days.map(day => {
      const toAdd = allToAdd.filter(a => a.dayNumber === day.dayNumber);
      if (toAdd.length === 0) return day;
      return { ...day, activities: [...day.activities, ...toAdd] };
    });
    const tripWithUpdates = { ...prev, days: updatedDays };
    const validatedDays = validateTrip(tripWithUpdates);
    return { ...tripWithUpdates, days: validatedDays };
  });
}, []);
```

**Step 2: Update `removeActivity` with cascade delete**

Replace the `removeActivity` callback filter line. Change:
```typescript
activities: day.activities.filter(a => a.id !== activityId),
```
To:
```typescript
activities: day.activities.filter(a =>
  a.id !== activityId && a.sourceActivityId !== activityId
),
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add lib/store.tsx
git commit -m "feat(v3): multi-night stay fanout in addActivity + cascade removeActivity (V3-2)"
```

---

### Task V3-3: UI — continuing stays render differently

**Files:**
- Modify: `components/DayDetailPanel.tsx`
- Modify: `components/DayCard.tsx`
- Modify: `components/DashboardModal.tsx`

**Step 1: DayDetailPanel — muted continuing stay rows**

In `DayDetailPanel.tsx`, inside the `Draggable` render, wrap the entire draggable with a continuing stay check. Find the `<Draggable>` block and add this branch before the existing content:

```tsx
// At the top of the Draggable render callback, after the opening <div ref={dragProvided.innerRef}...>
// Add a conditional render:

{activity.isContinuingStay ? (
  <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50 opacity-60">
    <span className="text-xl flex-shrink-0 ml-4">{activityIcons[activity.type] ?? '📍'}</span>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-500 italic">
        {activityIcons[activity.type]} Continuing stay
        {activity.parentDayNumber ? ` (from Day ${activity.parentDayNumber})` : ''}
      </p>
      <p className="text-xs text-gray-400 truncate">{activity.name}</p>
    </div>
    <button
      onClick={() => removeActivity(activity.id)}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs p-1"
      aria-label="Remove continuing stay"
    >
      ✕
    </button>
  </div>
) : (
  // ... existing full activity row JSX (drag handle, icons, name, buttons)
)}
```

Also destructure `removeActivity` from `useTrip()` in DayDetailPanel if not already there (it already is on line 29).

**Step 2: DayCard — skip continuing stays in activity list**

In `DayCard.tsx`, in the `day.activities.map(...)` render, filter out continuing stays so they don't clutter the card summary:

```tsx
{day.activities.filter(a => !a.isContinuingStay).map((activity) => (
  // existing activity row JSX
))}
```

Also update the activity count display:
```tsx
{day.activities.filter(a => !a.isContinuingStay).length}{' '}
{day.activities.filter(a => !a.isContinuingStay).length === 1 ? 'activity' : 'activities'}
```

**Step 3: DashboardModal — skip continuing stays in counts**

The `campingNights` and `hotelNights` already use `flatMap(d => d.activities)` after the previous fix. Add `.filter(a => !a.isContinuingStay)` to both:

```typescript
const campingNights = trip.days.flatMap(d => d.activities)
  .filter(a => a.type === 'camping' && !a.isContinuingStay)
  .reduce((sum, a) => sum + ((a as { nights?: number }).nights ?? 1), 0);
const hotelNights = trip.days.flatMap(d => d.activities)
  .filter(a => a.type === 'hotel' && !a.isContinuingStay)
  .reduce((sum, a) => sum + ((a as { nights?: number }).nights ?? 1), 0);
```

Same for `lodgingCost` and `ticketActivities`.

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 5: Commit**

```bash
git add components/DayDetailPanel.tsx components/DayCard.tsx components/DashboardModal.tsx
git commit -m "feat(v3): render continuing stays muted, filter from counts (V3-3)"
```

---

### Task V3-4: Map icons — AdvancedMarkerElement with emoji

**Files:**
- Modify: `components/Map.tsx`

**Step 1: Add emoji map constant and update markersRef type**

Near the top of `Map.tsx`, after `markerColors`, add:

```typescript
const activityEmojis: Record<ActivityType, string> = {
  trail: '🥾',
  hotel: '🏨',
  restaurant: '🍽️',
  camping: '⛺',
  park: '🏞️',
  driving: '🚗',
};
```

Change the `markersRef` type declaration (line 94):
```typescript
// FROM:
const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
// TO:
const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
```

**Step 2: Add `mapId` to map initialization**

In the `initMap` function, find `new maps.Map(mapRef.current, {` (around line 147) and add `mapId: 'DEMO_MAP_ID'`:

```typescript
const mapInstance = new maps.Map(mapRef.current, {
  center,
  zoom,
  mapId: 'DEMO_MAP_ID',  // required for AdvancedMarkerElement
  mapTypeControl: true,
  fullscreenControl: true,
  streetViewControl: false,
  zoomControl: true,
});
```

**Step 3: Replace marker creation with AdvancedMarkerElement**

In the `allActivities.forEach` block (around line 201), replace the entire `new google.maps.Marker(...)` call:

```typescript
// FROM:
const marker = new google.maps.Marker({
  position: activity.coordinates,
  map,
  title: activity.name,
  icon: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: markerColors[activity.type],
    fillOpacity: 0.9,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  },
});

// TO:
const el = document.createElement('div');
el.style.cssText = [
  'width:34px', 'height:34px',
  `background:${markerColors[activity.type]}`,
  'border-radius:50%',
  'border:2px solid white',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'font-size:17px',
  'box-shadow:0 2px 6px rgba(0,0,0,0.35)',
  'cursor:pointer',
].join(';');
el.textContent = activityEmojis[activity.type] ?? '📍';

const marker = new google.maps.marker.AdvancedMarkerElement({
  position: activity.coordinates,
  map,
  title: activity.name,
  content: el,
});
```

**Step 4: Fix marker cleanup**

In the cleanup line (around line 188):
```typescript
// FROM:
markersRef.current.forEach(marker => marker.setMap(null));
// TO:
markersRef.current.forEach(marker => { marker.map = null; });
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

If you get `Property 'AdvancedMarkerElement' does not exist on type 'typeof marker'`, ensure the Maps API URL in `loadGoogleMaps` still includes `libraries=places,geometry,marker` (it does — line 50).

Expected: 0 errors.

**Step 6: Visual check**

```bash
npm run dev
```

Open the app with a trip loaded. Map markers should now show emoji circles instead of colored dots.

**Step 7: Commit**

```bash
git add components/Map.tsx
git commit -m "feat(v3): replace map dots with emoji AdvancedMarkerElement icons (V3-4)"
```

---

### Task V3-5: API — `/api/scout/optimize-day`

**Files:**
- Create: `app/api/scout/optimize-day/route.ts`

**Step 1: Create the route**

```typescript
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

  if (!day?.activities?.length) {
    return Response.json({ error: 'day with activities required' }, { status: 400 });
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
    const result = JSON.parse(text) as { order: string[]; reasoning: string };

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
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Commit**

```bash
git add app/api/scout/optimize-day/route.ts
git commit -m "feat(v3): add /api/scout/optimize-day route (V3-5)"
```

---

### Task V3-6: UI — Optimize Order button in DayDetailPanel

**Files:**
- Modify: `components/DayDetailPanel.tsx`

**Step 1: Add state + handler**

At the top of the `DayDetailPanel` component, add:

```typescript
const [isOptimizing, setIsOptimizing] = useState(false);
const [optimizeReason, setOptimizeReason] = useState<string | null>(null);
```

Add the handler (after `handleDragEnd`):

```typescript
const handleOptimizeOrder = async () => {
  if (isOptimizing || day.activities.length < 2) return;
  setIsOptimizing(true);
  setOptimizeReason(null);
  try {
    const res = await fetch('/api/scout/optimize-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // trip is available via useTrip() — add it to the destructure at the top
      body: JSON.stringify({ day, trip }),
    });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json() as { order: string[]; reasoning: string };
    const reordered = data.order
      .map(id => day.activities.find(a => a.id === id))
      .filter(Boolean) as typeof day.activities;
    reorderActivities(day.dayNumber, reordered);
    setOptimizeReason(data.reasoning);
    setTimeout(() => setOptimizeReason(null), 6000);
  } catch {
    setOptimizeReason('Could not optimize — try again.');
    setTimeout(() => setOptimizeReason(null), 4000);
  } finally {
    setIsOptimizing(false);
  }
};
```

Also add `trip` to the `useTrip()` destructure in DayDetailPanel (it currently only destructures `removeActivity, reorderActivities, updateActivity`).

**Step 2: Add button to header**

In the header `<div className="flex items-center justify-between px-4 py-3 ...">`, add the button next to the close button:

```tsx
<div className="flex items-center gap-1">
  {day.activities.filter(a => !a.isContinuingStay).length >= 2 && (
    <button
      onClick={handleOptimizeOrder}
      disabled={isOptimizing}
      className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
      title="Let Scout reorder activities for the best experience"
    >
      {isOptimizing ? '⏳' : '✨'} Optimize
    </button>
  )}
  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
    ✕
  </button>
</div>
```

**Step 3: Add reasoning toast**

Between the Status Badges section and the Activities Timeline section, add:

```tsx
{optimizeReason && (
  <div className="mx-4 mb-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
    🐕 {optimizeReason}
  </div>
)}
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 5: Commit**

```bash
git add components/DayDetailPanel.tsx
git commit -m "feat(v3): Optimize Order button + Scout reasoning toast in DayDetailPanel (V3-6)"
```

---

### Task V3-7: API — `/api/scout/recommend-activities`

**Files:**
- Create: `app/api/scout/recommend-activities/route.ts`

**Step 1: Create the route**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Trip, Day, ActivityType } from '@/types';

const client = new Anthropic();

interface Suggestion {
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

export async function POST(request: Request) {
  let body: { type: ActivityType; day: Day; trip: Trip };
  try {
    body = await request.json() as { type: ActivityType; day: Day; trip: Trip };
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, day, trip } = body;

  const existingNames = day.activities.map(a => a.name).join(', ') || 'none';
  const locationHint = day.activities.find(a => a.type !== 'driving')?.name
    || day.activities[0]?.name
    || `Day ${day.dayNumber} of the trip`;

  const prompt = `You are Scout, a road trip assistant. Suggest 4 real ${type} options for a road trip day.

Location context: near ${locationHint}
Already planned this day: ${existingNames}
Trip: pace=${trip.tripPace}, dog=${trip.hasDog ? 'yes' : 'no'}, budget=${trip.budgetStyle}, people=${trip.peopleCount}

Requirements:
- Suggest REAL, specific places that actually exist (not generic descriptions)
- Make suggestions that complement what's already planned
- If dog=yes, note whether each place allows dogs
- Match the trip pace and budget

Respond with ONLY valid JSON, no markdown:
{
  "suggestions": [
    {"name": "Exact Place Name", "location": "City, State", "why": "One sentence", "isDogFriendly": true}
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const result = JSON.parse(text) as { suggestions: Suggestion[] };
    return Response.json(result);
  } catch (err) {
    console.error('recommend-activities error:', err);
    return Response.json({ error: 'Failed to get recommendations' }, { status: 500 });
  }
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Commit**

```bash
git add app/api/scout/recommend-activities/route.ts
git commit -m "feat(v3): add /api/scout/recommend-activities route (V3-7)"
```

---

### Task V3-8: UI — Find Activities panel in DayDetailPanel

**Files:**
- Create: `components/RecommendActivitiesPanel.tsx`
- Modify: `components/DayDetailPanel.tsx`

**Step 1: Create `RecommendActivitiesPanel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useTrip } from '@/lib/store';
import { geocodePlace } from '@/lib/geocoding';
import type { Day, ActivityType, Activity, CampingSpot } from '@/types';

interface Suggestion {
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

interface Props {
  day: Day;
  onClose: () => void;
}

const typeOptions: { type: ActivityType; label: string; emoji: string }[] = [
  { type: 'trail', label: 'Trail', emoji: '🥾' },
  { type: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { type: 'hotel', label: 'Hotel', emoji: '🏨' },
  { type: 'camping', label: 'Camping', emoji: '⛺' },
  { type: 'park', label: 'Park', emoji: '🏞️' },
];

export default function RecommendActivitiesPanel({ day, onClose }: Props) {
  const { trip, addActivity } = useTrip();
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<(Suggestion & { geocoded?: { lat: number; lng: number } | null })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleTypeSelect = async (type: ActivityType) => {
    setSelectedType(type);
    setIsLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const res = await fetch('/api/scout/recommend-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, day, trip }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { suggestions: Suggestion[] };

      // Geocode all suggestions in parallel
      const withCoords = await Promise.all(
        data.suggestions.map(async (s) => {
          const coords = await geocodePlace(`${s.name}, ${s.location}`);
          return { ...s, geocoded: coords };
        })
      );
      setSuggestions(withCoords);
    } catch {
      setError('Could not get recommendations. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = (s: typeof suggestions[0], index: number) => {
    if (!s.geocoded || !trip) return;
    const activity: Activity = {
      id: crypto.randomUUID(),
      type: selectedType!,
      name: s.name,
      coordinates: s.geocoded,
      dayNumber: day.dayNumber,
      isDogFriendly: s.isDogFriendly,
      notes: s.why,
      ...(selectedType === 'camping' ? {
        amenities: { free: false, fireRing: false, cellCoverage: false, water: false },
      } as Partial<CampingSpot> : {}),
    } as Activity;
    addActivity(activity);
    setAddedIds(prev => new Set(prev).add(index));
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">🐕 Find Activities</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs p-1">✕</button>
      </div>

      {/* Type selector */}
      {!selectedType && (
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(({ type, label, emoji }) => (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              className="flex flex-col items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors text-xs"
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-6 text-sm text-gray-500">
          <p className="text-xl mb-1">🐕</p>
          Scout is looking…
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Results */}
      {suggestions.length > 0 && (
        <>
          <button
            onClick={() => { setSelectedType(null); setSuggestions([]); setAddedIds(new Set()); }}
            className="text-xs text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
          >
            ← Change type
          </button>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.location}</p>
                    <p className="text-xs text-gray-600 mt-1">{s.why}</p>
                    {!s.geocoded && (
                      <p className="text-xs text-amber-600 mt-1">⚠️ Couldn&apos;t verify location</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAdd(s, i)}
                    disabled={!s.geocoded || addedIds.has(i)}
                    className={`flex-shrink-0 text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                      addedIds.has(i)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {addedIds.has(i) ? '✓ Added' : '+ Add'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Add Find Activities button to DayDetailPanel**

In `DayDetailPanel.tsx`:

1. Import the new component:
```tsx
import RecommendActivitiesPanel from './RecommendActivitiesPanel';
```

2. Add state:
```tsx
const [showRecommendPanel, setShowRecommendPanel] = useState(false);
```

3. In the footer area (between the activities list and "Add Activity" button), add:

```tsx
{/* Find Activities / Recommendations */}
{showRecommendPanel && (
  <RecommendActivitiesPanel
    day={day}
    onClose={() => setShowRecommendPanel(false)}
  />
)}
```

4. Update the footer button area to include the Find Activities button:

```tsx
<div className="border-t border-gray-200">
  {!showRecommendPanel && (
    <div className="px-4 pt-3 pb-1 flex gap-2">
      <button
        onClick={() => setShowRecommendPanel(true)}
        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-orange-300 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-50 transition-colors"
      >
        🔍 Find Activities
      </button>
    </div>
  )}
  <div className="p-4 pt-2">
    <button
      onClick={onAddActivity}
      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
    >
      <span>+</span>
      <span>Add Activity to Day {day.dayNumber}</span>
    </button>
  </div>
</div>
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add components/RecommendActivitiesPanel.tsx components/DayDetailPanel.tsx
git commit -m "feat(v3): Find Activities panel with Scout recommendations + geocode (V3-8)"
```

---

### Task V3-9: API — `/api/scout/plan-day`

**Files:**
- Create: `app/api/scout/plan-day/route.ts`

**Step 1: Create the route**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Trip, Day, ActivityType } from '@/types';

const client = new Anthropic();

interface PlannedActivity {
  type: ActivityType;
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

export async function POST(request: Request) {
  let body: { day: Day; trip: Trip };
  try {
    body = await request.json() as { day: Day; trip: Trip };
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { day, trip } = body;

  const existingSection = day.activities.length > 0
    ? `Existing activities to keep (plan AROUND these, don't repeat them):\n${day.activities.map(a => `- [${a.type}] ${a.name}`).join('\n')}`
    : 'No activities yet — plan the full day from scratch.';

  // Infer location from existing activities or adjacent days
  const prevDay = trip.days.find(d => d.dayNumber === day.dayNumber - 1);
  const locationActivity = day.activities.find(a => a.type !== 'driving')
    || prevDay?.activities.find(a => a.type === 'hotel' || a.type === 'camping')
    || prevDay?.activities.find(a => a.type !== 'driving');
  const locationHint = locationActivity?.name || `Day ${day.dayNumber} of the trip`;

  const prompt = `You are Scout, an expert road trip planner. Plan Day ${day.dayNumber}.

Location: near ${locationHint}
${existingSection}

Trip preferences:
- Pace: ${trip.tripPace} (relaxed=fewer/easier, balanced=moderate, adventure=full/challenging)
- Has dog: ${trip.hasDog ? 'yes — all activities must allow dogs or note if dog stays' : 'no'}
- Budget: ${trip.budgetStyle}
- People: ${trip.peopleCount}
- Max driving this day: ${trip.maxDrivingHours}h

Generate 3-5 activities that make a great, cohesive day. Order them as they would happen chronologically. Mix types naturally. Use REAL, specific place names that exist at this location.

Types available: trail, hotel, restaurant, camping, park, driving

Respond with ONLY valid JSON, no markdown:
{
  "activities": [
    {"type": "trail", "name": "Exact Place Name", "location": "City, State", "why": "Why this fits the day", "isDogFriendly": true}
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 768,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const result = JSON.parse(text) as { activities: PlannedActivity[] };
    return Response.json(result);
  } catch (err) {
    console.error('plan-day error:', err);
    return Response.json({ error: 'Failed to plan day' }, { status: 500 });
  }
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Commit**

```bash
git add app/api/scout/plan-day/route.ts
git commit -m "feat(v3): add /api/scout/plan-day route (V3-9)"
```

---

### Task V3-10: UI — PlanDayModal + Plan This Day button

**Files:**
- Create: `components/PlanDayModal.tsx`
- Modify: `components/DayDetailPanel.tsx`

**Step 1: Create `PlanDayModal.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTrip } from '@/lib/store';
import { geocodePlace } from '@/lib/geocoding';
import type { Day, Activity, ActivityType, CampingSpot } from '@/types';

interface PlannedActivity {
  type: ActivityType;
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
  geocoded?: { lat: number; lng: number } | null;
}

interface Props {
  day: Day;
  onClose: () => void;
}

const activityEmojis: Record<ActivityType, string> = {
  trail: '🥾', hotel: '🏨', restaurant: '🍽️',
  camping: '⛺', park: '🏞️', driving: '🚗',
};

export default function PlanDayModal({ day, onClose }: Props) {
  const { trip, addActivity } = useTrip();
  const [phase, setPhase] = useState<'loading' | 'preview' | 'error'>('loading');
  const [activities, setActivities] = useState<PlannedActivity[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/scout/plan-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day, trip }),
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json() as { activities: PlannedActivity[] };

        // Geocode in parallel
        const withCoords = await Promise.all(
          data.activities.map(async (a) => {
            const coords = await geocodePlace(`${a.name}, ${a.location}`);
            return { ...a, geocoded: coords };
          })
        );
        setActivities(withCoords);
        // Pre-check all geocoded items
        setChecked(new Set(withCoords.map((_, i) => i).filter(i => withCoords[i].geocoded)));
        setPhase('preview');
      } catch {
        setErrorMsg('Scout had trouble planning this day. Try again.');
        setPhase('error');
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCheck = (i: number) => {
    if (!activities[i].geocoded) return; // can't add ungeocoded
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleAddSelected = async () => {
    setIsAdding(true);
    for (const i of Array.from(checked)) {
      const a = activities[i];
      if (!a.geocoded) continue;
      const activity: Activity = {
        id: crypto.randomUUID(),
        type: a.type,
        name: a.name,
        coordinates: a.geocoded,
        dayNumber: day.dayNumber,
        isDogFriendly: a.isDogFriendly,
        notes: a.why,
        ...(a.type === 'camping' ? {
          amenities: { free: false, fireRing: false, cellCoverage: false, water: false },
        } as Partial<CampingSpot> : {}),
      } as Activity;
      addActivity(activity);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">🐕 Plan Day {day.dayNumber}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Scout&apos;s suggestions — check what to add</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {phase === 'loading' && (
            <div className="text-center py-10">
              <p className="text-2xl mb-3">🐕</p>
              <p className="text-sm text-gray-600">Scout is planning your day…</p>
              <p className="text-xs text-gray-400 mt-1">Geocoding suggestions</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="text-center py-8">
              <p className="text-sm text-red-500">{errorMsg}</p>
              <button onClick={onClose} className="mt-4 text-sm text-gray-600 underline">Close</button>
            </div>
          )}

          {phase === 'preview' && (
            <div className="space-y-3">
              {activities.map((a, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked.has(i) ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
                  } ${!a.geocoded ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(i)}
                    onChange={() => toggleCheck(i)}
                    disabled={!a.geocoded}
                    className="mt-1 rounded border-gray-300 text-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{activityEmojis[a.type]}</span>
                      <p className="font-medium text-gray-900 text-sm truncate">{a.name}</p>
                    </div>
                    <p className="text-xs text-gray-500">{a.location}</p>
                    <p className="text-xs text-gray-600 mt-1">{a.why}</p>
                    {!a.geocoded && (
                      <p className="text-xs text-amber-600 mt-1">⚠️ Couldn&apos;t verify location</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'preview' && (
          <div className="px-5 py-4 border-t flex gap-3">
            <button
              onClick={handleAddSelected}
              disabled={checked.size === 0 || isAdding}
              className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors text-sm"
            >
              {isAdding ? 'Adding…' : `Add ${checked.size} Selected`}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white text-gray-700 py-2.5 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Wire up in DayDetailPanel**

In `DayDetailPanel.tsx`:

1. Import:
```tsx
import PlanDayModal from './PlanDayModal';
```

2. Add state:
```tsx
const [showPlanModal, setShowPlanModal] = useState(false);
```

3. Add modal render (at the bottom of the component return, outside the main div):
```tsx
{showPlanModal && (
  <PlanDayModal day={day} onClose={() => setShowPlanModal(false)} />
)}
```

4. Add "Plan This Day" button to the footer button row (next to "Find Activities"):
```tsx
<div className="px-4 pt-3 pb-1 flex gap-2">
  <button
    onClick={() => setShowRecommendPanel(prev => !prev)}
    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-orange-300 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-50 transition-colors"
  >
    🔍 Find Activities
  </button>
  <button
    onClick={() => setShowPlanModal(true)}
    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-blue-300 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
  >
    ✨ Plan This Day
  </button>
</div>
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Full build**

```bash
npm run build
```
Expected: Compiled successfully.

**Step 5: Commit**

```bash
git add components/PlanDayModal.tsx components/DayDetailPanel.tsx
git commit -m "feat(v3): PlanDayModal + Plan This Day button in DayDetailPanel (V3-10)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| V3-1 | Activity type fields | `types/index.ts` |
| V3-2 | Multi-night store logic | `lib/store.tsx` |
| V3-3 | Continuing stay UI | `DayDetailPanel`, `DayCard`, `DashboardModal` |
| V3-4 | Map emoji icons | `components/Map.tsx` |
| V3-5 | Optimize day API | `app/api/scout/optimize-day/route.ts` |
| V3-6 | Optimize day UI | `components/DayDetailPanel.tsx` |
| V3-7 | Recommend activities API | `app/api/scout/recommend-activities/route.ts` |
| V3-8 | Recommend activities UI | `RecommendActivitiesPanel.tsx`, `DayDetailPanel` |
| V3-9 | Plan day API | `app/api/scout/plan-day/route.ts` |
| V3-10 | PlanDayModal + button | `PlanDayModal.tsx`, `DayDetailPanel` |
