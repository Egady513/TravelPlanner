# V8 — Bug Fixes, Scout Tools, and Activity Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 regressions introduced in V7 and add 4 new capabilities (Scout remove-activity tool, auto arrival time, departure time rule, activity connector lines on map).

**Architecture:** All bugs are isolated single-file fixes. The two Scout features (remove-activity tool + departure rule) follow the exact pattern of existing tools in `app/api/scout/chat/route.ts` + `components/ScoutPanel.tsx`. Activity connector lines are a new Map.tsx useEffect drawing thin dotted polylines between consecutive activities in a day.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Google Maps JS API (DirectionsService, AdvancedMarkerElement), Anthropic SDK (claude-sonnet-4-6)

---

### Task 1: V8-1 — Fix driving routes showing as straight lines

**Root Cause:** V7-6 changed the `dirService.route()` call to always include `waypoints: [] ` and `optimizeWaypoints: false` even when there are no waypoints. Passing an empty `waypoints` array combined with `optimizeWaypoints: false` causes the Google Maps DirectionsService to fail silently, falling back to the straight-line fallback at lines 469-474 of Map.tsx.

**Fix:** Only include `waypoints` and `optimizeWaypoints` in the request when `drive.waypoints` actually has entries.

**Files:**
- Modify: `components/Map.tsx` (lines 453-463)

**Step 1: Read the file**
Read `components/Map.tsx` lines 447-480. Confirm the exact current code of the `dirService.route()` call.

**Step 2: Replace the dirService.route() call**

Find this exact block (lines 453-476):
```typescript
        const dirService = new google.maps.DirectionsService();
        dirService.route(
          {
            origin: drive.startLocation.coordinates,
            destination: drive.endLocation.coordinates,
            waypoints: drive.waypoints?.map(w => ({
              location: new google.maps.LatLng(w.coordinates.lat, w.coordinates.lng),
              stopover: true,
            })) ?? [],
            optimizeWaypoints: false,
            travelMode: google.maps.TravelMode.DRIVING,
          },
```

Replace with:
```typescript
        const dirService = new google.maps.DirectionsService();
        dirService.route(
          {
            origin: drive.startLocation.coordinates,
            destination: drive.endLocation.coordinates,
            ...(drive.waypoints?.length ? {
              waypoints: drive.waypoints.map(w => ({
                location: new google.maps.LatLng(w.coordinates.lat, w.coordinates.lng),
                stopover: true,
              })),
              optimizeWaypoints: false,
            } : {}),
            travelMode: google.maps.TravelMode.DRIVING,
          },
```

The spread `...(condition ? {...} : {})` pattern means `waypoints` and `optimizeWaypoints` are only included when there are actual waypoints.

**Step 3: Verify TypeScript**
```bash
cd C:\Users\eddie.gady\Desktop\travel-planner && npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**
```bash
git add components/Map.tsx
git commit -m "fix(v8): conditionally pass waypoints to DirectionsService — restores route drawing (V8-1)"
```

---

### Task 2: V8-2 — Fix Scout error showing raw JSON

**Root Cause:** `ScoutPanel.tsx` line 121 appends `parsed.error` as chat text: `const chunk = parsed.text ?? parsed.error ?? ''`. When Anthropic returns an overloaded error, the raw error object appears as message content.

**Files:**
- Modify: `components/ScoutPanel.tsx` (around line 121)

**Step 1: Read the file**
Read `components/ScoutPanel.tsx` lines 105-135. Find the exact code around `const chunk = parsed.text ?? parsed.error ?? ''`.

**Step 2: Replace the chunk extraction line**

Find:
```typescript
              const chunk = parsed.text ?? parsed.error ?? '';
              if (chunk) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: updated[updated.length - 1].content + chunk,
                  };
                  return updated;
                });
              }
```

Replace with:
```typescript
              if (parsed.error) {
                // Replace placeholder assistant message with user-friendly error
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: '⚠️ Scout is temporarily unavailable. Please try again in a moment.',
                  };
                  return updated;
                });
                break;
              }
              const chunk = parsed.text ?? '';
              if (chunk) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: updated[updated.length - 1].content + chunk,
                  };
                  return updated;
                });
              }
```

Note: `break` exits the `for (const part of parts)` loop cleanly when an error is received.

**Step 3: Verify TypeScript**
```bash
cd C:\Users\eddie.gady\Desktop\travel-planner && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add components/ScoutPanel.tsx
git commit -m "fix(v8): show friendly error message when Scout API is overloaded (V8-2)"
```

---

### Task 3: V8-3 — Fix Find Activities location hint for drive-only days

**Root Cause:** `app/api/scout/recommend-activities/route.ts` line 35-37: when a day has ONLY driving activities, `day.activities.find(a => a.type !== 'driving')` returns undefined and it falls back to `day.activities[0]?.name` which is a driving activity's name (e.g. "Austin to Denver"). Scout then searches near a location that doesn't exist, returning no results.

**Fix:** When the fallback is a driving activity, use its `endLocation.name` instead of its `name`.

**Files:**
- Modify: `app/api/scout/recommend-activities/route.ts` (lines 34-37)

**Step 1: Read the file**
Read `app/api/scout/recommend-activities/route.ts` lines 1-45.

**Step 2: Fix the location hint**

Find:
```typescript
  const locationHint = day.activities.find(a => a.type !== 'driving')?.name
    || day.activities[0]?.name
    || `Day ${day.dayNumber} of the trip`;
```

Replace with:
```typescript
  const firstDrive = day.activities.find(a => a.type === 'driving') as import('@/types').DrivingActivity | undefined;
  const locationHint = day.activities.find(a => a.type !== 'driving')?.name
    || firstDrive?.endLocation?.name
    || `Day ${day.dayNumber} of the trip`;
```

Note: `DrivingActivity` needs to be imported. Check the current imports at the top of the file — `Day` and `ActivityType` are already imported from `@/types`. Add `DrivingActivity` to that import:
```typescript
import type { Trip, Day, ActivityType, DrivingActivity } from '@/types';
```

**Step 3: Verify TypeScript**
```bash
cd C:\Users\eddie.gady\Desktop\travel-planner && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add app/api/scout/recommend-activities/route.ts
git commit -m "fix(v8): use driving endLocation as location hint when day has no non-drive activities (V8-3)"
```

---

### Task 4: V8-4 — Show waypoint marker pins on map

**Problem:** V7-6 added `waypoints` to `DrivingActivity` and passes them to DirectionsService, but Map.tsx never renders visual marker pins for them. Users can't see their stops on the map.

**Files:**
- Modify: `components/Map.tsx` (the markers useEffect, around lines 206-258)

**Step 1: Read the markers useEffect**
Read `components/Map.tsx` lines 206-260. Understand the `AdvancedMarkerElement` creation pattern and `markersRef`.

**Step 2: Add waypoint pin rendering**

The markers useEffect builds `allActivities` from `trip.days.flatMap(day => day.activities)`. After the `allActivities.forEach(activity => { ... })` block (which renders activity markers), add waypoint markers for DrivingActivities.

Find the line `  }, [map, trip, visibleTypes, selectedDays]);` that closes the markers useEffect (around line 257). Just BEFORE that closing `}, [...]` line, add:

```typescript
    // Render waypoint pins for driving activities
    if (visibleTypes.has('driving')) {
      const drivingActivities = trip.days
        .flatMap(d => d.activities)
        .filter(a => a.showOnMap !== false && a.type === 'driving' && isDaySelected(a.dayNumber)) as DrivingActivity[];

      drivingActivities.forEach(drive => {
        (drive.waypoints ?? []).forEach((wp, i) => {
          const el = document.createElement('div');
          el.style.cssText = [
            'width:22px', 'height:22px',
            'background:#ea580c',
            'border-radius:50%',
            'border:2px solid white',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'font-size:11px',
            'box-shadow:0 1px 4px rgba(0,0,0,0.3)',
          ].join(';');
          el.textContent = '📍';

          const marker = new google.maps.marker.AdvancedMarkerElement({
            position: wp.coordinates,
            map,
            title: wp.name,
            content: el,
          });

          // Use a compound key so waypoint markers don't collide with activity markers
          markersRef.current.set(`wp-${drive.id}-${i}`, marker);
        });
      });
    }
```

Note: `DrivingActivity` is already imported at the top of Map.tsx.

**Step 3: Verify TypeScript**
```bash
cd C:\Users\eddie.gady\Desktop\travel-planner && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add components/Map.tsx
git commit -m "feat(v8): render marker pins for waypoint stops on driving activities (V8-4)"
```

---

### Task 5: V8-5 — Auto-calculate arrival time when departure changes

**Problem:** V7-4 added a "Auto-calculate from departure + drive time" button. User wants it to auto-fill without pressing a button — just set departure time and arrival auto-calculates.

**Fix:** Replace the button with a `useEffect` that auto-calculates arrival whenever `departureTime` changes and `estimatedDriveHours` is known and `arrivalTime` is empty.

**Files:**
- Modify: `components/AddActivityForm.tsx`

**Step 1: Read the file**
Read `components/AddActivityForm.tsx` lines 415-455. Find the departure/arrival time section. Look for:
1. The "Auto-calculate" button and its `onClick` logic (compute arrival from departure + drive hours)
2. The `departureTime`, `arrivalTime`, `estimatedDriveHours` state declarations

**Step 2: Remove the auto-calculate button and add a useEffect**

Find and REMOVE the button:
```tsx
    {departureTime && estimatedDriveHours && !arrivalTime && (
      <button
        type="button"
        onClick={() => {
          const [h, m] = departureTime.split(':').map(Number);
          const totalMins = h * 60 + m + Math.round(estimatedDriveHours * 60);
          const ah = Math.floor(totalMins / 60) % 24;
          const am = totalMins % 60;
          setArrivalTime(`${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`);
        }}
        className="mt-1 text-xs text-blue-600 hover:text-blue-700"
      >
        Auto-calculate from departure + drive time
      </button>
    )}
```

Instead, add a `useEffect` near the other driving useEffects (look for the auto-suggest hotel/camping useEffect). Place this new effect AFTER the waypoints state declarations and before the camping state:

```typescript
// Auto-calculate arrival time when departure is set and drive hours are known
useEffect(() => {
  if (!departureTime || !estimatedDriveHours || arrivalTime) return;
  const [h, m] = departureTime.split(':').map(Number);
  const totalMins = h * 60 + m + Math.round(estimatedDriveHours * 60);
  const ah = Math.floor(totalMins / 60) % 24;
  const am = totalMins % 60;
  setArrivalTime(`${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`);
}, [departureTime, estimatedDriveHours]); // eslint-disable-line react-hooks/exhaustive-deps
```

Note: `arrivalTime` is intentionally excluded from deps — we only auto-fill when it's empty, and we don't want the effect to un-set a user's manual entry.

Also add a small hint below the arrival time input (replace the space where the button was):
```tsx
<p className="text-xs text-gray-400 mt-1">Auto-calculated from departure + drive time</p>
```
But only show this hint when `departureTime && estimatedDriveHours && arrivalTime`:
```tsx
{departureTime && estimatedDriveHours && arrivalTime && (
  <p className="text-xs text-gray-400 mt-1">Auto-calculated from departure + drive time</p>
)}
```

**Step 3: Verify TypeScript**
```bash
cd C:\Users\eddie.gady\Desktop\travel-planner && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add components/AddActivityForm.tsx
git commit -m "feat(v8): auto-calculate arrival time when departure changes (V8-5)"
```

---

### Task 6: V8-6 — Scout departure time recommendation rule

**Problem:** Scout should proactively recommend what time to leave for long drives, especially when no departure time is set on a day's driving activities.

**Files:**
- Modify: `app/api/scout/chat/route.ts`

**Step 1: Read the system prompt rules**
Read `app/api/scout/chat/route.ts` lines 145-158. Find the `CAMPING ARRIVAL RULE` and `WOW FACTOR RULE` lines.

**Step 2: Add DEPARTURE TIME RULE**

Find the line:
```
WOW FACTOR RULE: Every response must include at least one insight...
```

Add a new rule BEFORE it (after `CAMPING ARRIVAL RULE`):
```
DEPARTURE TIME RULE: When a day has 4+ hours of total driving and no departure time is set (no "depart HH:MM" in the trip summary for that day), proactively recommend a specific departure time based on: (a) desired arrival before dark (assume 7pm), (b) camping check-in windows (usually 2-4pm), (c) tourist attraction opening times if applicable. Say something like: "For Day N's 5h drive, I'd suggest leaving by 8am to arrive comfortably — want me to set that as your departure time?"
```

**Step 3: Verify TypeScript**
```bash
cd C:\Users\eddie.gady\Desktop\travel-planner && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add app/api/scout/chat/route.ts
git commit -m "feat(v8): Scout proactively recommends departure time for long drive days (V8-6)"
```

---

### Task 7: V8-7 — Scout "remove activity" tool

**Problem:** User wants Scout to be able to clean up/remove activities from the itinerary via chat.

**Architecture:** Follows the exact pattern of `SUGGEST_ADD_ACTIVITY_TOOL`. Scout calls the tool with `day_number` + `activity_name`. The API sends a `remove_activity` SSE event. ScoutPanel finds the activity by name in the specified day and calls `removeActivity(activityId)`.

**Files:**
- Modify: `app/api/scout/chat/route.ts`
- Modify: `components/ScoutPanel.tsx`

**Step 1: Add REMOVE_ACTIVITY_TOOL to chat/route.ts**

Read `app/api/scout/chat/route.ts` lines 42-64. After the `SUGGEST_ADD_ACTIVITY_TOOL` const, add:

```typescript
const REMOVE_ACTIVITY_TOOL: Anthropic.Tool = {
  name: 'remove_activity',
  description:
    'Remove a specific activity from a specific day when the user asks to delete, clean up, or remove something. ' +
    'Only call when the user clearly wants an activity removed. Confirm what you removed in your text response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      day_number: { type: 'number', description: 'The day number the activity is on' },
      activity_name: { type: 'string', description: 'The exact name of the activity to remove' },
      reason: { type: 'string', description: 'One sentence why this is being removed' },
    },
    required: ['day_number', 'activity_name', 'reason'],
  },
};
```

**Step 2: Add tool to messages.stream() call and handle in stream.on('message')**

Find line 218:
```typescript
          tools: [SUGGEST_ROUTE_CHANGE_TOOL, SUGGEST_ADD_ACTIVITY_TOOL],
```
Change to:
```typescript
          tools: [SUGGEST_ROUTE_CHANGE_TOOL, SUGGEST_ADD_ACTIVITY_TOOL, REMOVE_ACTIVITY_TOOL],
```

Find the `stream.on('message', async (msg) => {` block (around line 227). Inside the `for (const block of msg.content)` loop, after the `suggest_add_activity` handler, add:

```typescript
            if (block.type === 'tool_use' && block.name === 'remove_activity') {
              if (!closed) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'remove_activity', payload: block.input })}\n\n`
                  )
                );
              }
            }
```

**Step 3: Handle remove_activity in ScoutPanel.tsx**

Read `components/ScoutPanel.tsx` lines 1-35. Note the existing state imports from the store (`addActivity` on line 17). Add `removeActivity` to the destructure:

Find:
```typescript
  const { trip, addActivity } = useTrip();
```
Change to:
```typescript
  const { trip, addActivity, removeActivity } = useTrip();
```

In the SSE stream parser, find the `activity_suggestion` handler (around line 116-120):
```typescript
              if (parsed.type === 'activity_suggestion' && parsed.payload) {
                setActivitySuggestion(parsed.payload as ActivitySuggestion);
                setActivityAdded(false);
                continue;
              }
```

Add after it:
```typescript
              if (parsed.type === 'remove_activity' && parsed.payload) {
                const { day_number, activity_name } = parsed.payload as { day_number: number; activity_name: string };
                if (trip) {
                  const day = trip.days.find(d => d.dayNumber === day_number);
                  const activity = day?.activities.find(
                    a => a.name.toLowerCase() === activity_name.toLowerCase()
                  );
                  if (activity) {
                    removeActivity(activity.id);
                  }
                }
                continue;
              }
```

**Step 4: Verify TypeScript**
```bash
cd C:\Users\eddie.gady\Desktop\travel-planner && npx tsc --noEmit
```

**Step 5: Commit**
```bash
git add app/api/scout/chat/route.ts components/ScoutPanel.tsx
git commit -m "feat(v8): Scout can remove activities from itinerary via chat (V8-7)"
```

---

### Task 8: V8-8 — Activity connector lines (dotted lines from last stop to each activity)

**Problem:** After a drive ends at location B, the user wants to see a dotted line on the map from B to their next activity (restaurant, trail, etc.) to understand "how far is it to get there." The existing day routes (colored dashes from activity to activity) treat driving activities as simple waypoints using startLocation coords, which means the path goes FROM drive start TO activities rather than FROM drive END TO activities.

**Fix:** Add a new dedicated useEffect that draws thin gray dotted connector lines between consecutive activities in each day, correctly using DrivingActivity.endLocation as the "from" point when a drive precedes another activity. These are simple straight dotted polylines (no DirectionsService needed — the user wants to see direction and rough distance, not exact road paths).

**Files:**
- Modify: `components/Map.tsx`

**Step 1: Find the right place to add the useEffect**
Read `components/Map.tsx` lines 479-510. Find just after the closing of the driving polylines useEffect (`}, [map, trip, visibleTypes, selectedDays, showDriveTimeTooltip];`).

**Step 2: Add activityConnectorPolylinesRef**
Read the top of Map.tsx (lines 60-100) to find where `drivingPolylinesRef` and `dayRoutePolylinesRef` are declared. Add a new ref alongside them:

Find the block of polyline refs (look for `drivingPolylinesRef` and `dayRoutePolylinesRef`). Add:
```typescript
  const activityConnectorRef = useRef<google.maps.Polyline[]>([]);
```

**Step 3: Add the connector lines useEffect**

After the driving polylines useEffect (after line `}, [map, trip, visibleTypes, selectedDays, showDriveTimeTooltip];`), add:

```typescript
  // Dotted connector lines: from drive endpoint → next activity (or activity → next activity)
  useEffect(() => {
    if (!map || !trip) return;

    activityConnectorRef.current.forEach(p => p.setMap(null));
    activityConnectorRef.current = [];

    trip.days.forEach(day => {
      if (!isDaySelected(day.dayNumber)) return;

      const visible = day.activities.filter(a => a.showOnMap !== false);
      if (visible.length < 2) return;

      // Build ordered "position after" array: where you ARE after completing each activity
      const positions: Array<{ lat: number; lng: number }> = visible.map(a => {
        if (a.type === 'driving') {
          const drive = a as DrivingActivity;
          return drive.endLocation?.coordinates ?? a.coordinates;
        }
        return a.coordinates;
      });

      // For each consecutive pair, draw a connector from where you were TO where the next activity is
      for (let i = 0; i < visible.length - 1; i++) {
        const from = positions[i];
        const toActivity = visible[i + 1];

        // Skip if next activity is a driving activity (it has its own orange polyline)
        if (toActivity.type === 'driving') continue;

        const connector = new google.maps.Polyline({
          path: [from, toActivity.coordinates],
          geodesic: false,
          strokeColor: '#9ca3af',
          strokeOpacity: 0,
          strokeWeight: 0,
          icons: [{
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 0.5,
              scale: 2,
              strokeColor: '#6b7280',
            },
            offset: '0',
            repeat: '10px',
          }],
          map,
          zIndex: 0,
        });
        activityConnectorRef.current.push(connector);
      }
    });
  }, [map, trip, visibleTypes, selectedDays]);
```

Note: The `DrivingActivity` type is already imported at the top of Map.tsx.

**Step 4: Verify TypeScript**
```bash
cd C:\Users\eddie.gady\Desktop\travel-planner && npx tsc --noEmit
```

**Step 5: Commit**
```bash
git add components/Map.tsx
git commit -m "feat(v8): dotted connector lines from drive endpoint to next activity on map (V8-8)"
```

---

## Verification Checklist

After all tasks, spot-check in dev server (`npm run dev`, localhost:3000):

1. **V8-1:** Add a driving activity → route should draw as a real road polyline (not straight diagonal line). Hover over route → shows drive time tooltip.
2. **V8-2:** Open Scout → send a message when Scout is unavailable → should show "⚠️ Scout is temporarily unavailable" instead of raw JSON.
3. **V8-3:** Add a day with ONLY a driving activity (no hotel/restaurant) → open Find Activities → should suggest places near the drive's destination, not fail with "none found."
4. **V8-4:** Add a driving activity with waypoints (e.g., Mt. Rushmore as a stop) → a small orange 📍 pin should appear at the waypoint location.
5. **V8-5:** Add a driving activity → set departure time → arrival time should auto-fill immediately (no button needed). Hint text "Auto-calculated from departure + drive time" should appear below.
6. **V8-6:** Open Scout and ask about a day with a long drive that has no departure time → Scout should proactively suggest a specific departure time.
7. **V8-7:** Open Scout → say "remove the restaurant from day 3" (or similar) → Scout should call the remove tool → activity disappears from the day. Scout's text response confirms what was removed.
8. **V8-8:** Add a day with a drive then activities → map should show thin gray dotted connector lines from the drive's end location to each subsequent activity pin.

## Files Changed Summary

| File | Tasks |
|------|-------|
| `components/Map.tsx` | V8-1, V8-4, V8-8 |
| `components/ScoutPanel.tsx` | V8-2, V8-7 |
| `app/api/scout/recommend-activities/route.ts` | V8-3 |
| `components/AddActivityForm.tsx` | V8-5 |
| `app/api/scout/chat/route.ts` | V8-6, V8-7 |
