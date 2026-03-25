# Road Trip Planner v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship 7 approved feature areas: navigation fix, Scout AI assistant, DayDetailPanel enhancements, map layer filters, route hover, wizard preset validation, and dashboard stats panel.

**Architecture:** 14 sequential tasks, each independently committable. Scout uses `claude-sonnet-4-6` for chat (trip JSON injected into system prompt — no RAG) and `claude-haiku-4-5-20251001` for proactive tips. Map layers + day filters are local React state. Drag-and-drop uses `@hello-pangea/dnd`. Distance Matrix fetched via Google Maps JS API `DistanceMatrixService` (already loaded client-side).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `@anthropic-ai/sdk` (already installed), `@hello-pangea/dnd` (needs install), Google Maps JS API + DistanceMatrixService, Supabase (already configured)

**Test approach:** No test suite exists. For each task: verify TypeScript compiles (`npx tsc --noEmit`), verify visually in dev server, confirm `npm run build` still passes before moving on.

**Working directory:** `C:\Users\eddie.gady\Desktop\travel-planner`

---

## Task 1 (V2-A1): TopNav + Navigation Fix

**Problem:** `app/page.tsx` returns early when `trip` exists — homepage and Import button are unreachable. No way back.

**Files:**
- Create: `components/TopNav.tsx`
- Modify: `app/page.tsx` (lines 67–84: map view branch)

**Step 1: Create `components/TopNav.tsx`**

```tsx
'use client';

import { useTrip } from '@/lib/store';

interface TopNavProps {
  onImport: () => void;
  onDashboard: () => void;
  onScout: () => void;
}

export default function TopNav({ onImport, onDashboard, onScout }: TopNavProps) {
  const { trip, clearTrip, isSaving } = useTrip();

  const handleHome = () => {
    if (confirm('Go back to home? Your trip is saved and can be resumed.')) {
      clearTrip();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={handleHome}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ← Home
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base leading-tight">{trip?.name ?? 'Road Trip'}</h1>
          {isSaving && <p className="text-xs text-gray-400">Saving…</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onScout}
          className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-orange-50 hover:text-orange-700 transition-colors"
          title="Ask Scout"
        >
          🐕 Scout
        </button>
        <button
          onClick={onImport}
          className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          📋 Import
        </button>
        <button
          onClick={onDashboard}
          className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          📊 Dashboard
        </button>
      </div>
    </header>
  );
}
```

**Step 2: Modify `app/page.tsx` map view branch**

Replace the `if (trip)` block (lines 68–84) with:

```tsx
  if (trip) {
    return (
      <div className="flex flex-col h-screen">
        <TopNav
          onImport={() => setShowImport(true)}
          onDashboard={() => setShowDashboard(true)}
          onScout={() => setShowScout(prev => !prev)}
        />
        <main className="flex-1 flex overflow-hidden">
          <Sidebar />
          <div className="flex-1 relative">
            <TripMap />
          </div>
        </main>
        <ImportItinerary isOpen={showImport} onClose={() => setShowImport(false)} />
      </div>
    );
  }
```

Also add these state declarations in `Home()` (after `showImport`):
```tsx
  const [showDashboard, setShowDashboard] = useState(false);
  const [showScout, setShowScout] = useState(false);
```

And add the TopNav import at top:
```tsx
import TopNav from "@/components/TopNav";
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If `showDashboard`/`showScout` show "declared but never read" warnings — that's fine, they'll be consumed in Tasks 8 and 13.

**Step 4: Visual check**

```bash
npm run dev
```

Open `http://localhost:3000`. Create a trip via wizard → verify TopNav appears with `← Home`, `📋 Import`, `📊 Dashboard`, `🐕 Scout` buttons. Click `← Home` → confirm dialog → returns to homepage. Click `📋 Import` → ImportItinerary modal opens.

**Step 5: Commit**

```bash
git add components/TopNav.tsx app/page.tsx
git commit -m "feat(nav): add TopNav bar to map view — fixes homepage dead-end bug (V2-A1)"
```

---

## Task 2 (V2-E1): Wizard Preset Validation Rules

**Problem:** `lib/validation.ts` validates camping/weather/dog-at-campsite rules but ignores the user's wizard presets (`maxDrivingHours`, `tripPace`).

**Files:**
- Modify: `lib/validation.ts`

**Step 1: Extend `validateDay` signature**

The current signature:
```ts
export function validateDay(
  day: Day,
  nextDay: Day | null,
  allDays: Day[],
  trip: { hasDog: boolean; isNewCamper: boolean }
): ValidationStatus
```

Change `trip` parameter to:
```ts
trip: {
  hasDog: boolean;
  isNewCamper: boolean;
  maxDrivingHours: number;
  tripPace: 'relaxed' | 'balanced' | 'adventure';
}
```

**Step 2: Add 3 new rules in `validateDay` (after the existing 4 rules, before the `if (messages.length === 0)` return)**

```ts
  // Rule 5: maxDrivingHours exceeded on a driving activity
  for (const act of day.activities) {
    if (act.type === 'driving') {
      const drive = act as import('../types/index').DrivingActivity;
      if (drive.estimatedDriveHours !== undefined && drive.estimatedDriveHours > trip.maxDrivingHours) {
        messages.push({
          level: 'warning',
          message: `Driving ${drive.estimatedDriveHours}h exceeds your ${trip.maxDrivingHours}h daily limit`,
          suggestion: 'Break the drive into two days or adjust your max driving hours preference',
        });
      }
    }
  }

  // Rule 6: hasDog + non-dog-friendly activity
  if (trip.hasDog) {
    const nonDogActs = day.activities.filter(a => a.isDogFriendly === false);
    for (const act of nonDogActs) {
      messages.push({
        level: 'error',
        message: `"${act.name}" is not dog-friendly`,
        suggestion: 'Arrange care for your dog while at this activity',
      });
    }
  }

  // Rule 7: relaxed pace but too many activities
  if (trip.tripPace === 'relaxed' && day.activities.length > 3) {
    messages.push({
      level: 'warning',
      message: `${day.activities.length} activities planned — a lot for a relaxed pace`,
      suggestion: 'Consider moving some activities to adjacent days',
    });
  }
```

**Step 3: Update `validateTrip` to pass new fields**

Current call in `validateTrip`:
```ts
    const validationStatus = validateDay(day, nextDay, sorted, {
      hasDog: trip.hasDog,
      isNewCamper: trip.isNewCamper,
    });
```

Change to:
```ts
    const validationStatus = validateDay(day, nextDay, sorted, {
      hasDog: trip.hasDog,
      isNewCamper: trip.isNewCamper,
      maxDrivingHours: trip.maxDrivingHours,
      tripPace: trip.tripPace,
    });
```

**Step 4: Fix the DrivingActivity import inside the function**

The type cast for `drive` — instead of an inline import, add `DrivingActivity` to the top-level import:

At top of `lib/validation.ts`, change:
```ts
import type {
  Day,
  Trip,
  ValidationLevel,
  ValidationMessage,
  ValidationStatus,
  LodgingType,
} from '../types/index';
```

To:
```ts
import type {
  Day,
  Trip,
  ValidationLevel,
  ValidationMessage,
  ValidationStatus,
  LodgingType,
  DrivingActivity,
} from '../types/index';
```

And in Rule 5, change `as import('../types/index').DrivingActivity` to just `as DrivingActivity`.

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 6: Visual check**

Add a driving activity with `estimatedDriveHours: 9` to a trip with `maxDrivingHours: 6` → verify yellow `🟡` warning badge appears on DayCard and full message in DayDetailPanel.

**Step 7: Commit**

```bash
git add lib/validation.ts
git commit -m "feat(validation): add wizard preset rules — maxDrivingHours, hasDog, tripPace (V2-E1)"
```

---

## Task 3 (V2-C1): Add `showOnMap` to Activity Type

**Files:**
- Modify: `types/index.ts` (line 19–27, the `Activity` interface)

**Step 1: Add field to `Activity` interface**

In `types/index.ts`, in the `Activity` interface, add one line after `notes?`:

```ts
export interface Activity {
  id: string;
  type: ActivityType;
  name: string;
  coordinates: Coordinates;
  dayNumber: number;
  isDogFriendly: boolean;
  notes?: string;
  showOnMap?: boolean;  // undefined / true = visible, false = hidden
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. `showOnMap` is optional so no existing code breaks.

**Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add showOnMap optional field to Activity (V2-C1)"
```

---

## Task 4 (V2-C2): Drag-and-Drop Activity Reorder in DayDetailPanel

**Files:**
- Modify: `components/DayDetailPanel.tsx`
- `package.json` (new dependency)

**Step 1: Install `@hello-pangea/dnd`**

```bash
npm install @hello-pangea/dnd
npm install --save-dev @types/hello-pangea__dnd
```

Note: `@hello-pangea/dnd` ships its own types, so the `@types` package may not exist — that's fine if the install gives a 404, just skip it and run:
```bash
npm install @hello-pangea/dnd
```

**Step 2: Add drag-and-drop to `DayDetailPanel.tsx`**

Replace the current activity list in `DayDetailPanel.tsx`. Current list is at lines 82–113 (`<div className="space-y-2">...`).

First, add imports at top of `DayDetailPanel.tsx`:
```tsx
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
```

Also add `reorderActivities` to the `useTrip` destructure (line 28):
```tsx
  const { removeActivity, reorderActivities } = useTrip();
```

Then add the drag handler before the `return` statement:
```tsx
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const reordered = Array.from(day.activities);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    reorderActivities(day.dayNumber, reordered);
  };
```

Replace the activities list JSX (the `<div className="space-y-2">` block at line ~81) with:

```tsx
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`day-${day.dayNumber}`}>
            {(provided) => (
              <div
                className="space-y-2"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {day.activities.map((activity, index) => (
                  <Draggable key={activity.id} draggableId={activity.id} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`flex items-start gap-3 group p-2 rounded-lg ${
                          dragSnapshot.isDragging ? 'bg-orange-50 shadow-md' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Drag handle */}
                        <div
                          {...dragProvided.dragHandleProps}
                          className="flex flex-col items-center flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing"
                        >
                          <span className="text-gray-300 text-xs leading-none">⠿</span>
                          <span className="text-xl mt-0.5">{activityIcons[activity.type] ?? '📍'}</span>
                          {index < day.activities.length - 1 && (
                            <div className="w-0.5 h-4 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{activity.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 capitalize">{activity.type}</span>
                            {activity.isDogFriendly ? (
                              <span className="text-xs text-green-600">🐕</span>
                            ) : (
                              <span className="text-xs text-red-500">🚫</span>
                            )}
                          </div>
                          {activity.notes && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{activity.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeActivity(activity.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs p-1"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Visual check**

```bash
npm run dev
```

Open a day with 3+ activities → DayDetailPanel → drag the ⠿ handle to reorder → verify order updates in sidebar and map.

**Step 5: Commit**

```bash
git add components/DayDetailPanel.tsx package.json package-lock.json
git commit -m "feat(daydetail): drag-and-drop activity reorder via @hello-pangea/dnd (V2-C2)"
```

---

## Task 5 (V2-C3): Show/Hide Activity on Map Toggle

**Files:**
- Modify: `components/DayDetailPanel.tsx`
- Modify: `components/Map.tsx`

**Step 1: Add toggle button to each activity row in `DayDetailPanel.tsx`**

Inside the `<div className="flex-1 min-w-0">` block in each activity row (from Task 4), add a toggle button next to the remove button. Find the `<button onClick={() => removeActivity(activity.id)}` button and add a sibling before it:

```tsx
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateActivity(activity.id, { showOnMap: activity.showOnMap === false ? true : false });
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 text-xs p-1"
                          title={activity.showOnMap === false ? 'Show on map' : 'Hide from map'}
                          aria-label={activity.showOnMap === false ? 'Show on map' : 'Hide from map'}
                        >
                          {activity.showOnMap === false ? '👁️‍🗨️' : '👁️'}
                        </button>
```

Also add `updateActivity` to the `useTrip` destructure in `DayDetailPanel.tsx`:
```tsx
  const { removeActivity, reorderActivities, updateActivity } = useTrip();
```

**Step 2: Filter hidden activities in `Map.tsx`**

In `Map.tsx`, the markers effect (lines 150–188) currently does:
```ts
    const allActivities = trip.days.flatMap(day => day.activities);
```

Change this to filter hidden activities:
```ts
    const allActivities = trip.days.flatMap(day => day.activities).filter(a => a.showOnMap !== false);
```

Similarly in the driving polylines effect (line 222):
```ts
    const allActivities = trip.days.flatMap(d => d.activities);
```
Change to:
```ts
    const allActivities = trip.days.flatMap(d => d.activities).filter(a => a.showOnMap !== false);
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Visual check**

Add an activity → DayDetailPanel → hover over activity row → click 👁️ → verify marker disappears from map. Click 👁️‍🗨️ → verify marker reappears.

**Step 5: Commit**

```bash
git add components/DayDetailPanel.tsx components/Map.tsx
git commit -m "feat(daydetail): show/hide activity on map toggle per activity row (V2-C3)"
```

---

## Task 6 (V2-D1): Map Layer Filters + Day Selector

**Files:**
- Modify: `components/Map.tsx`

**Step 1: Add filter state in `TripMap` component**

In `Map.tsx`, after the existing state declarations (around line 73), add:

```tsx
  // Layer filters
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    () => new Set(['trail', 'hotel', 'restaurant', 'camping', 'park', 'driving'])
  );
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set()); // empty = all days
```

**Step 2: Create `MapFilters` component inside `Map.tsx` (before the `TripMap` export)**

Add this before the `export default function TripMap` line:

```tsx
interface MapFiltersProps {
  activeTypes: Set<string>;
  onToggleType: (type: string) => void;
  activeDays: Set<number>;
  onToggleDay: (day: number) => void;
  totalDays: number;
}

const LAYER_GROUPS = [
  { label: '🏔️ Activities', types: ['trail', 'park', 'restaurant'] },
  { label: '🚗 Driving', types: ['driving'] },
  { label: '🏨 Lodging', types: ['hotel', 'camping'] },
];

function MapFilters({ activeTypes, onToggleType, activeDays, onToggleDay, totalDays }: MapFiltersProps) {
  const isGroupActive = (types: string[]) => types.every(t => activeTypes.has(t));

  const toggleGroup = (types: string[]) => {
    const allOn = isGroupActive(types);
    types.forEach(t => onToggleType(allOn ? `off-${t}` : `on-${t}`));
  };

  const allDaysActive = activeDays.size === 0;

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-3 z-10 min-w-[180px] select-none">
      <p className="text-xs font-semibold text-gray-700 mb-2">Map Layers</p>
      <div className="space-y-1.5 mb-3">
        {LAYER_GROUPS.map(group => {
          const active = isGroupActive(group.types);
          return (
            <button
              key={group.label}
              onClick={() => toggleGroup(group.types)}
              className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${
                active ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {group.label}
            </button>
          );
        })}
      </div>
      {totalDays > 1 && (
        <>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Days</p>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => { if (!allDaysActive) onToggleDay(-1); }}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                allDaysActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {Array.from({ length: totalDays }, (_, i) => i + 1).map(dayNum => (
              <button
                key={dayNum}
                onClick={() => onToggleDay(dayNum)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  !allDaysActive && activeDays.has(dayNum)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {dayNum}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 3: Add toggle handlers in `TripMap`**

After the filter state declarations, add:

```tsx
  const handleToggleType = (typeKey: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (typeKey.startsWith('off-')) {
        next.delete(typeKey.slice(4));
      } else if (typeKey.startsWith('on-')) {
        next.add(typeKey.slice(3));
      } else {
        if (next.has(typeKey)) next.delete(typeKey);
        else next.add(typeKey);
      }
      return next;
    });
  };

  const handleToggleDay = (dayNum: number) => {
    if (dayNum === -1) {
      setActiveDays(new Set()); // -1 = "All"
      return;
    }
    setActiveDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNum)) next.delete(dayNum);
      else next.add(dayNum);
      return next;
    });
  };
```

**Step 4: Apply filters to markers effect**

In the markers `useEffect` (the one that starts `if (!map || !trip) return;` and loops `allActivities`), update the activity filter line:

```ts
    const allActivities = trip.days
      .flatMap(day => day.activities)
      .filter(a =>
        a.showOnMap !== false &&
        activeTypes.has(a.type) &&
        (activeDays.size === 0 || activeDays.has(a.dayNumber))
      );
```

Also add `activeTypes` and `activeDays` to the `useEffect` dependency array:
```ts
  }, [map, trip, activeTypes, activeDays]);
```

Do the same for the driving polylines effect dependency array:
```ts
  }, [map, trip, activeTypes, activeDays]);
```

And filter driving activities similarly:
```ts
    const drivingActivities = trip.days
      .flatMap(d => d.activities)
      .filter(a =>
        a.type === 'driving' &&
        a.showOnMap !== false &&
        activeTypes.has('driving') &&
        (activeDays.size === 0 || activeDays.has(a.dayNumber))
      ) as DrivingActivity[];
```

**Step 5: Render `MapFilters` in the JSX**

In the `return (...)` of `TripMap`, add `<MapFilters>` as an overlay in the map container. Currently the `<div ref={mapRef}` is the first child. The return is wrapped in `<>...</>`. Change it to a `<div className="relative w-full h-full">` wrapper:

Replace:
```tsx
  return (
    <>
      {/* Map container: always in DOM so mapRef is available during async init */}
      <div ref={mapRef} className={className} style={{ visibility: (loading || error) ? 'hidden' : 'visible' }} />
      ...
```

With:
```tsx
  return (
    <div className={`relative ${className}`} style={{ height: '100%', width: '100%' }}>
      {/* Map container: always in DOM so mapRef is available during async init */}
      <div ref={mapRef} className="w-full h-full" style={{ visibility: (loading || error) ? 'hidden' : 'visible' }} />

      {/* Layer filters overlay */}
      {map && trip && (
        <MapFilters
          activeTypes={activeTypes}
          onToggleType={handleToggleType}
          activeDays={activeDays}
          onToggleDay={handleToggleDay}
          totalDays={trip.days.length}
        />
      )}
```

And close with `</div>` instead of `</>`. Keep all the existing error/loading/form portals inside this wrapper.

**Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 7: Visual check**

```bash
npm run dev
```

Verify filter panel appears top-right on map. Toggle "🏨 Lodging" → hotel/camping markers disappear. Select Day 1 chip → only Day 1 activities visible.

**Step 8: Commit**

```bash
git add components/Map.tsx
git commit -m "feat(map): layer filter controls — type toggles + day multi-select (V2-D1)"
```

---

## Task 7 (V2-D2): Route Hover — Drive Time via Distance Matrix

**Files:**
- Modify: `components/Map.tsx`

**Step 1: Add distance cache ref in `TripMap`**

After the `drivingPolylinesRef` declaration, add:
```tsx
  const distanceCacheRef = useRef<Map<string, string>>(new Map());
```

**Step 2: Add info window ref**

After `distanceCacheRef`, add:
```tsx
  const hoverInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
```

**Step 3: Create the hover info window once after map initializes**

In the marker `useEffect` (which runs when `map` is available), add after clearing existing markers:

Actually, create the InfoWindow once when the map initializes. In the map init `useEffect`, after `setMap(mapInstance)`, add:
```tsx
        hoverInfoWindowRef.current = new maps.InfoWindow();
```

**Step 4: Update driving polylines effect to add hover handlers**

In the driving polylines `useEffect`, after creating each polyline, add hover listeners:

```tsx
      // Cache key for this route
      const cacheKey = `${drive.startLocation.coordinates.lat},${drive.startLocation.coordinates.lng}→${drive.endLocation.coordinates.lat},${drive.endLocation.coordinates.lng}`;

      polyline.addListener('mouseover', (e: google.maps.PolyMouseEvent) => {
        const cached = distanceCacheRef.current.get(cacheKey);
        if (cached) {
          if (hoverInfoWindowRef.current && e.latLng) {
            hoverInfoWindowRef.current.setContent(`<div style="font-size:13px;padding:4px 6px">${cached}</div>`);
            hoverInfoWindowRef.current.setPosition(e.latLng);
            hoverInfoWindowRef.current.open(map);
          }
          return;
        }

        // Fetch from Distance Matrix service
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix(
          {
            origins: [drive.startLocation.coordinates],
            destinations: [drive.endLocation.coordinates],
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (response, status) => {
            if (status === 'OK' && response?.rows[0]?.elements[0]?.status === 'OK') {
              const el = response.rows[0].elements[0];
              const text = `🚗 ${el.duration.text} · ${el.distance.text}`;
              distanceCacheRef.current.set(cacheKey, text);
              if (hoverInfoWindowRef.current && e.latLng) {
                hoverInfoWindowRef.current.setContent(`<div style="font-size:13px;padding:4px 6px">${text}</div>`);
                hoverInfoWindowRef.current.setPosition(e.latLng);
                hoverInfoWindowRef.current.open(map);
              }
            }
          }
        );
      });

      polyline.addListener('mouseout', () => {
        hoverInfoWindowRef.current?.close();
      });
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. (Google Maps types ship `DistanceMatrixService` with the `@types/google.maps` package which is included via `@googlemaps/js-api-loader`.)

**Step 6: Visual check**

Add two driving activities with start/end locations → map shows dashed polylines → hover over a dashed line → tooltip shows `🚗 2h 15min · 143 mi`.

**Step 7: Commit**

```bash
git add components/Map.tsx
git commit -m "feat(map): route hover shows drive time via Distance Matrix API (V2-D2)"
```

---

## Task 8 (V2-B3): Scout Proactive Tips API

**Files:**
- Create: `app/api/scout/tips/route.ts`

**Step 1: Create directory and file**

```bash
mkdir -p app/api/scout
```

Create `app/api/scout/tips/route.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { Trip } from '@/types';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { trip?: Trip };
    if (!body.trip) {
      return NextResponse.json({ tips: [] });
    }

    const tripJson = JSON.stringify(body.trip, null, 2);

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are Scout, a friendly road trip planning assistant. Analyze the trip and return 1-3 brief, helpful, proactive tips as JSON.

Return ONLY valid JSON: { "tips": [{ "id": "tip-1", "message": "...", "type": "warning" | "info" | "suggestion" }] }

Focus on practical issues:
- Logistics gaps (activities far apart with no lodging between)
- Dog logistics (non-dog-friendly activities without care plan)
- Driving time issues (long drives, no breaks)
- Weather concerns when visible

Be specific — mention actual place names and day numbers. Be concise (1-2 sentences per tip). Skip generic advice.`,
      messages: [
        {
          role: 'user',
          content: `Here is the current trip plan:\n\n${tripJson}\n\nGenerate 1-3 helpful tips. Return empty array if the plan looks fine.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ tips: [] });
    }

    const raw = content.text;
    const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) ?? raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const parsed = JSON.parse(jsonStr) as { tips: Array<{ id: string; message: string; type: string }> };

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Scout tips error:', err);
    return NextResponse.json({ tips: [] });
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
git add app/api/scout/tips/route.ts
git commit -m "feat(scout): POST /api/scout/tips — proactive trip tips via Claude Haiku (V2-B3)"
```

---

## Task 9 (V2-B2): Scout Chat API (Streaming)

**Files:**
- Create: `app/api/scout/chat/route.ts`

**Step 1: Create `app/api/scout/chat/route.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { Trip } from '@/types';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      trip: Trip;
    };

    if (!body.messages?.length || !body.trip) {
      return new Response('Missing messages or trip', { status: 400 });
    }

    const tripJson = JSON.stringify(body.trip, null, 2);

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are Scout 🐕, a friendly and knowledgeable road trip planning assistant helping plan a road trip.

Here is the current trip plan in JSON format:
${tripJson}

Answer questions about this trip, suggest improvements, and help with planning decisions. Be friendly, concise, and specific. Reference actual place names and day numbers from the plan. If asked about dog-friendly options, be especially helpful. If the trip is empty, help the user figure out where they want to go.`,
      messages: body.messages,
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(new TextEncoder().encode(event.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('Scout chat error:', err);
    return new Response('Error processing request', { status: 500 });
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
git add app/api/scout/chat/route.ts
git commit -m "feat(scout): POST /api/scout/chat — streaming chat with full trip context (V2-B2)"
```

---

## Task 10 (V2-B4): ScoutPanel Chat Drawer

**Files:**
- Create: `components/ScoutPanel.tsx`
- Modify: `app/page.tsx` (wire the floating button + panel)

**Step 1: Create `components/ScoutPanel.tsx`**

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTrip } from '@/lib/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ScoutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScoutPanel({ isOpen, onClose }: ScoutPanelProps) {
  const { trip } = useTrip();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/scout/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, trip }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }
    } catch (err) {
      console.error('Scout chat error:', err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: "Sorry, I couldn't connect. Please try again.",
        };
        return updated;
      });
    }

    setIsStreaming(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 w-96 h-[520px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-orange-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐕</span>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Scout</h3>
            <p className="text-xs text-gray-500">Your trip planning companion</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded"
          aria-label="Close Scout"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">🐕</p>
            <p className="text-sm text-gray-700 font-medium">Hey! I'm Scout</p>
            <p className="text-xs text-gray-500 mt-1">
              Ask me anything about your trip — logistics, dog-friendly spots, routing suggestions.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content || (isStreaming && i === messages.length - 1 ? (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">·</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>·</span>
                </span>
              ) : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask Scout anything…"
            disabled={isStreaming}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg disabled:opacity-40 transition-colors font-medium"
            aria-label="Send"
          >
            →
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">Powered by Claude</p>
      </div>
    </div>
  );
}
```

**Step 2: Wire Scout in `app/page.tsx`**

Add import:
```tsx
import ScoutPanel from "@/components/ScoutPanel";
```

In the `if (trip)` branch, inside the `<div className="flex flex-col h-screen">`, after `<ImportItinerary>`, add:

```tsx
        {/* Scout floating button */}
        <button
          onClick={() => setShowScout(prev => !prev)}
          className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl z-30 transition-colors ${
            showScout ? 'bg-orange-500 hover:bg-orange-600' : 'bg-white hover:bg-orange-50 border border-gray-200'
          }`}
          title="Ask Scout"
          aria-label="Open Scout AI assistant"
        >
          🐕
        </button>
        <ScoutPanel isOpen={showScout} onClose={() => setShowScout(false)} />
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Visual check**

```bash
npm run dev
```

Click 🐕 button (bottom-right) → ScoutPanel opens. Type "What should I know about Day 1?" → see streaming response. Verify "← Home" still works. Close Scout → floating button still visible.

**Step 5: Commit**

```bash
git add components/ScoutPanel.tsx app/page.tsx
git commit -m "feat(scout): ScoutPanel streaming chat drawer + floating 🐕 button (V2-B4)"
```

---

## Task 11 (V2-B5): Scout Proactive Tips in Sidebar

**Files:**
- Create: `components/ScoutTip.tsx`
- Modify: `components/Sidebar.tsx`

**Step 1: Create `components/ScoutTip.tsx`**

```tsx
interface ScoutTipProps {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'suggestion';
  onDismiss: (id: string) => void;
}

const tipStyles = {
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  suggestion: 'bg-green-50 border-green-200 text-green-900',
};

const tipIcons = {
  warning: '⚠️',
  info: '💡',
  suggestion: '🐕',
};

export default function ScoutTip({ id, message, type, onDismiss }: ScoutTipProps) {
  return (
    <div className={`rounded-lg border p-2.5 flex items-start gap-2 ${tipStyles[type]}`}>
      <span className="text-sm flex-shrink-0 mt-0.5">{tipIcons[type]}</span>
      <p className="text-xs flex-1 leading-snug">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="text-xs opacity-50 hover:opacity-100 flex-shrink-0 ml-1"
        aria-label="Dismiss tip"
      >
        ✕
      </button>
    </div>
  );
}
```

**Step 2: Modify `Sidebar.tsx` — add tips state + fetch + render**

Add imports at top of `Sidebar.tsx`:
```tsx
import { useState, useEffect, useRef } from 'react';
import ScoutTip from './ScoutTip';
```

Note: `useState` is already imported. Add `useEffect` and `useRef` to that import.

Add tip types above the component:
```tsx
interface ScoutTipData {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'suggestion';
}
```

Inside `Sidebar()` function, after `const [showAddForm, setShowAddForm] = useState(false);`, add:

```tsx
  const [scoutTips, setScoutTips] = useState<ScoutTipData[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('scout-dismissed-tips');
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const tipsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Add useEffect for fetching tips (debounced 3s after trip changes):

```tsx
  useEffect(() => {
    if (!trip || trip.days.every(d => d.activities.length === 0)) return;

    if (tipsTimerRef.current) clearTimeout(tipsTimerRef.current);

    tipsTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/scout/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip }),
        });
        if (!res.ok) return;
        const data = await res.json() as { tips: ScoutTipData[] };
        if (data.tips?.length) {
          setScoutTips(data.tips.filter(t => !dismissedIds.has(t.id)));
        }
      } catch {
        // Silent fail — tips are nice-to-have
      }
    }, 3000);

    return () => {
      if (tipsTimerRef.current) clearTimeout(tipsTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.days.flatMap(d => d.activities).length]);

  const dismissTip = (id: string) => {
    setScoutTips(prev => prev.filter(t => t.id !== id));
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('scout-dismissed-tips', JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  };
```

In the desktop sidebar JSX, in the "Day List Column" div, add scout tips above the day list. Find `<div className="flex-1 overflow-y-auto p-4 space-y-3">` and add before it:

```tsx
              {/* Scout proactive tips */}
              {scoutTips.length > 0 && (
                <div className="px-4 pt-3 space-y-2">
                  <p className="text-xs text-gray-500 font-medium">🐕 Scout's tips</p>
                  {scoutTips.map(tip => (
                    <ScoutTip key={tip.id} {...tip} onDismiss={dismissTip} />
                  ))}
                </div>
              )}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Visual check**

Open a trip with activities → after ~3 seconds, Scout tip callout appears above day list. Click ✕ → tip dismisses and stays dismissed on page refresh.

**Step 5: Commit**

```bash
git add components/ScoutTip.tsx components/Sidebar.tsx
git commit -m "feat(scout): proactive tip callouts in Sidebar — debounced 3s, dismissible (V2-B5)"
```

---

## Task 12 (V2-F1): Dashboard Stats Modal

**Files:**
- Create: `components/DashboardModal.tsx`
- Modify: `app/page.tsx` (wire showDashboard state → modal)

**Step 1: Create `components/DashboardModal.tsx`**

```tsx
'use client';

import { Trip } from '@/types';
import { getWeatherEmoji } from '@/lib/weather';
import { getValidationEmoji } from '@/lib/validation';

interface DashboardModalProps {
  trip: Trip;
  onClose: () => void;
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function DashboardModal({ trip, onClose }: DashboardModalProps) {
  const totalActivities = trip.days.reduce((sum, d) => sum + d.activities.length, 0);
  const drivingActivities = trip.days.flatMap(d => d.activities).filter(a => a.type === 'driving');
  const hotelNights = trip.days.filter(d => d.activities.some(a => a.type === 'hotel')).length;
  const campingNights = trip.days.filter(d => d.activities.some(a => a.type === 'camping')).length;
  const unknownNights = trip.days.length - hotelNights - campingNights;

  const errorDays = trip.days.filter(d => d.validationStatus.level === 'error').length;
  const warningDays = trip.days.filter(d => d.validationStatus.level === 'warning').length;

  const daysWithWeather = trip.days.filter(d => d.weather);

  const nonDogActivities = trip.days.flatMap(d =>
    d.activities.filter(a => a.isDogFriendly === false).map(a => ({ ...a, dayNumber: d.dayNumber }))
  );

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">📊 Trip Dashboard</h2>
            <p className="text-sm text-gray-500">{trip.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close dashboard"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Trip Overview */}
          <StatCard title="🗺️ Trip Overview">
            <div className="space-y-1.5 text-sm text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500">Dates</span>
                <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span>{trip.days.length} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Travelers</span>
                <span>{trip.peopleCount} people{trip.hasDog ? ' + 🐕' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pace</span>
                <span className="capitalize">{trip.tripPace}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Activities</span>
                <span>{totalActivities} total</span>
              </div>
            </div>
          </StatCard>

          {/* Driving Summary */}
          <StatCard title="🚗 Driving Summary">
            <div className="space-y-1.5 text-sm text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500">Driving days</span>
                <span>{drivingActivities.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Max daily drive</span>
                <span>{trip.maxDrivingHours}h limit</span>
              </div>
              {drivingActivities.length > 0 && (
                <div className="mt-2 space-y-1">
                  {drivingActivities.slice(0, 4).map(a => (
                    <p key={a.id} className="text-xs text-gray-500 truncate">🚗 {a.name}</p>
                  ))}
                  {drivingActivities.length > 4 && (
                    <p className="text-xs text-gray-400">+{drivingActivities.length - 4} more</p>
                  )}
                </div>
              )}
              {drivingActivities.length === 0 && (
                <p className="text-xs text-gray-400 italic">No driving activities yet</p>
              )}
            </div>
          </StatCard>

          {/* Lodging Breakdown */}
          <StatCard title="🏨 Lodging Breakdown">
            <div className="space-y-1.5 text-sm text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500">Hotel nights</span>
                <span>{hotelNights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Camping nights</span>
                <span>{campingNights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Unplanned nights</span>
                <span className={unknownNights > 0 ? 'text-yellow-600 font-medium' : ''}>{unknownNights}</span>
              </div>
              {unknownNights > 0 && (
                <p className="text-xs text-yellow-600 mt-1">⚠️ {unknownNights} night{unknownNights > 1 ? 's' : ''} without lodging planned</p>
              )}
            </div>
          </StatCard>

          {/* Dog Status */}
          <StatCard title="🐕 Dog Status">
            {!trip.hasDog ? (
              <p className="text-sm text-gray-400 italic">No dog on this trip</p>
            ) : (
              <div className="space-y-1.5 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500">Non-dog activities</span>
                  <span className={nonDogActivities.length > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                    {nonDogActivities.length}
                  </span>
                </div>
                {nonDogActivities.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {nonDogActivities.slice(0, 4).map(a => (
                      <p key={a.id} className="text-xs text-red-600 truncate">Day {a.dayNumber}: {a.name}</p>
                    ))}
                  </div>
                )}
                {nonDogActivities.length === 0 && (
                  <p className="text-xs text-green-600">All activities are dog-friendly! 🎉</p>
                )}
              </div>
            )}
          </StatCard>

          {/* Validation Summary */}
          <StatCard title="✅ Validation Summary">
            <div className="space-y-1.5 text-sm text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500">Days with errors</span>
                <span className={errorDays > 0 ? 'text-red-600 font-medium' : ''}>{errorDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Days with warnings</span>
                <span className={warningDays > 0 ? 'text-yellow-600 font-medium' : ''}>{warningDays}</span>
              </div>
            </div>
            {trip.days.filter(d => d.validationStatus.level !== 'success').length > 0 && (
              <div className="mt-3 space-y-1">
                {trip.days.filter(d => d.validationStatus.level !== 'success').map(d => (
                  <div key={d.dayNumber} className="text-xs">
                    <span>{getValidationEmoji(d.validationStatus.level)} Day {d.dayNumber}: </span>
                    <span className="text-gray-600">
                      {d.validationStatus.messages.filter(m => m.level !== 'success')[0]?.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </StatCard>

          {/* Weather Snapshot */}
          <StatCard title="🌤️ Weather Snapshot">
            {daysWithWeather.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Weather loads automatically when activities have coordinates</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {trip.days.map(d => (
                  <div key={d.dayNumber} className="text-xs text-gray-700 flex items-center gap-1.5">
                    <span className="text-gray-400 w-10 flex-shrink-0">Day {d.dayNumber}</span>
                    {d.weather ? (
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                        {getWeatherEmoji(d.weather)} {d.weather.high}°/{d.weather.low}°
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </StatCard>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Wire `DashboardModal` in `app/page.tsx`**

Add import:
```tsx
import DashboardModal from "@/components/DashboardModal";
```

In the `if (trip)` branch, after `<ScoutPanel>`, add:
```tsx
        {showDashboard && (
          <DashboardModal trip={trip} onClose={() => setShowDashboard(false)} />
        )}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Visual check**

Click `📊 Dashboard` in TopNav → full-screen modal opens with all 6 stat cards. Click ✕ → closes. Verify all sections populate correctly from trip data.

**Step 5: Commit**

```bash
git add components/DashboardModal.tsx app/page.tsx
git commit -m "feat(dashboard): stats panel modal — overview, driving, lodging, dog, validation, weather (V2-F1/F2)"
```

---

## Task 13 (V2-B1): Supabase Scout Messages Table (Optional — Chat History Persistence)

**This task is optional.** Scout chat already works fully in-memory (state resets on page reload). Add this if you want chat history to persist across sessions.

**Step 1: Run this SQL in the Supabase dashboard SQL editor**

Go to: `https://supabase.com/dashboard/project/qxtcfbcteuqtofdusbrb/sql`

```sql
create table if not exists scout_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists scout_messages_trip_id_idx
  on scout_messages (trip_id, created_at);
```

**Step 2: Optionally load/save messages in `ScoutPanel.tsx`**

This is a low-priority enhancement. The chat panel works without it. If desired, add a `useEffect` on mount that calls `supabase.from('scout_messages').select('*').eq('trip_id', trip.id).order('created_at')` and sets `messages` state. On each new message, insert into the table.

**Step 3: Commit if SQL was applied**

```bash
git add components/ScoutPanel.tsx
git commit -m "feat(scout): persist chat history in Supabase scout_messages table (V2-B1)"
```

---

## Task 14: Final Build Verification

**Step 1: TypeScript full check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: ESLint check**

```bash
npm run lint
```

Expected: 0 errors (warnings OK).

**Step 3: Production build**

```bash
npm run build
```

Expected: All 8+ pages compile. The known Windows `.nft.json` ENOENT warning may still appear — this is a pre-existing Next.js 14 Windows-specific race condition, not a code error. As long as `Compiled successfully` appears before any trace errors, the build is valid.

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: v2 complete — Scout AI, nav fix, drag-drop, map filters, validation, dashboard"
```

---

## Priority Order Reference

| # | Task ID | Feature | Priority |
|---|---------|---------|----------|
| 1 | V2-A1 | Navigation fix (TopNav) | Critical — unblocks everything |
| 2 | V2-E1 | Wizard preset validation | Quick win — pure logic |
| 3 | V2-C1 | `showOnMap` type field | Prereq for C2/C3 |
| 4 | V2-C2 | Drag-and-drop reorder | UX quality |
| 5 | V2-C3 | Show/hide map toggle | UX quality |
| 6 | V2-D1 | Map layer filters | Map power feature |
| 7 | V2-D2 | Route hover drive time | Map power feature |
| 8 | V2-B3 | Scout tips API | Scout backend |
| 9 | V2-B2 | Scout chat API | Scout backend |
| 10 | V2-B4 | ScoutPanel component | Scout frontend |
| 11 | V2-B5 | Scout tips in Sidebar | Scout frontend |
| 12 | V2-F1+F2 | Dashboard modal | Lowest priority |
| 13 | V2-B1 | Supabase scout_messages | Optional enhancement |
| 14 | — | Final build verify | Always last |
