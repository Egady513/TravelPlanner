# V6 — Map Routes, Scout Polish, Preference Profile Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve map interactivity (route hover, lodging layer, select-all), polish Scout (scroll fix, bullet format, drive distance, add-activity tool, driving warnings), widen the Add Activity form, and add a user preference profile.

**Architecture:** All changes are additive to existing components. Map work modifies `Map.tsx` (refactors DirectionsRenderer → Polylines for hover support). Scout work modifies `app/api/scout/chat/route.ts` (system prompt + new tool) and `ScoutPanel.tsx` (new suggestion card UI). Preferences add a new type, new modal, and Scout integration.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Google Maps JS API (DirectionsService, DistanceMatrixService, Polyline, InfoWindow), Anthropic SDK (claude-sonnet-4-6)

---

### Task 1: V6-6 — Fix Scout panel blocking itinerary scroll

**Files:**
- Modify: `components/ScoutPanel.tsx`

**Problem:** The `<div className="fixed inset-0 z-40" onClick={onClose} />` backdrop covers the entire screen including the Sidebar day list. Users can't scroll their itinerary while Scout is open.

**Fix:** Remove the backdrop entirely. The Scout drawer has a prominent ✕ close button and clicking outside via TopNav toggle already works. This matches common drawer UX patterns where the panel doesn't block the rest of the app.

**Step 1: Remove the backdrop div**

In `components/ScoutPanel.tsx`, find and delete this block:
```tsx
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={onClose} />
      )}
```

**Step 2: Verify TypeScript**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add components/ScoutPanel.tsx
git commit -m "fix(v6): remove Scout backdrop so itinerary stays scrollable while panel is open (V6-6)"
```

---

### Task 2: V6-5 — Scout: drive distance + bullet formatting + trip summary fix

**Files:**
- Modify: `types/index.ts`
- Modify: `components/AddActivityForm.tsx`
- Modify: `app/api/scout/chat/route.ts`

**Context:** `DrivingActivity.estimatedDriveHours` is saved, but `estimatedDriveDistance` (the miles string, e.g. "143 mi") is NOT stored — it's only local state in the form. Scout therefore only knows hours, not miles, and guesses wrong. Fix by persisting the distance string. Also tighten the Scout system prompt to force bullet lists.

**Step 1: Add `estimatedDriveDistance` to DrivingActivity type**

In `types/index.ts`, find the `DrivingActivity` interface:
```typescript
export interface DrivingActivity extends Activity {
  type: 'driving';
  startLocation: { name: string; coordinates: Coordinates; };
  endLocation: { name: string; coordinates: Coordinates; };
  estimatedDriveHours?: number;
}
```

Add the distance field:
```typescript
export interface DrivingActivity extends Activity {
  type: 'driving';
  startLocation: { name: string; coordinates: Coordinates; };
  endLocation: { name: string; coordinates: Coordinates; };
  estimatedDriveHours?: number;
  estimatedDriveDistance?: string; // e.g. "143 mi"
}
```

**Step 2: Save `estimatedDriveDistance` in AddActivityForm**

In `components/AddActivityForm.tsx`, find the driving activity submit block (around line 196):
```typescript
      const activity: Activity = {
        id: existingActivity ? existingActivity.id : crypto.randomUUID(),
        type: 'driving',
        name: driveName,
        coordinates: driveStart.coordinates,
        dayNumber: currentDayNumber,
        isDogFriendly: true,
        notes: notes.trim() || undefined,
        startLocation: driveStart,
        endLocation: driveEnd,
        estimatedDriveHours: estimatedDriveHours ?? undefined,
      } as DrivingActivity;
```

Add `estimatedDriveDistance`:
```typescript
        estimatedDriveHours: estimatedDriveHours ?? undefined,
        estimatedDriveDistance: estimatedDriveDistance || undefined,
```

**Step 3: Update trip summary in Scout chat route to include drive distance**

In `app/api/scout/chat/route.ts`, find the `driveInfo` construction (around line 65):
```typescript
      const hrs = drive.estimatedDriveHours ? ` (~${drive.estimatedDriveHours}h)` : '';
      return `${drive.startLocation?.name ?? '?'} → ${drive.endLocation?.name ?? '?'}${hrs}`;
```

Replace with:
```typescript
      const drive2 = d as { startLocation?: { name: string }; endLocation?: { name: string }; estimatedDriveHours?: number; estimatedDriveDistance?: string };
      const hrs = drive2.estimatedDriveHours ? ` (~${drive2.estimatedDriveHours}h` : '';
      const dist = drive2.estimatedDriveDistance ? ` · ${drive2.estimatedDriveDistance}` : '';
      const suffix = (hrs || dist) ? `${hrs}${dist})` : '';
      return `${drive2.startLocation?.name ?? '?'} → ${drive2.endLocation?.name ?? '?'}${suffix}`;
```

**Step 4: Tighten bullet formatting instruction in Scout system prompt**

In `app/api/scout/chat/route.ts`, find the `RESPONSE STYLE` section of the system prompt (around line 75). Replace:
```
RESPONSE STYLE:
- Break responses into short paragraphs by topic — one idea per paragraph, with a blank line between them.
- Keep each paragraph to 1–3 sentences. No walls of text.
- Lead with the most important thing first.
- If listing 3+ items, use a brief bullet list instead of a paragraph.
- Never say "I'd be happy to" or "Great question!" — just answer.
- When you notice a problem, name it clearly and offer to fix it.
```

With:
```
RESPONSE STYLE — STRICT:
- NEVER write paragraphs. Every response is bullets or 1–2 sentence answers.
- Use bullet points (–) for ANY list of 2+ items, recommendations, or steps.
- Max 2 sentences per bullet. One idea per bullet. No run-ons.
- Lead with the most important thing first.
- Never say "I'd be happy to", "Great question!", or "Certainly!" — just answer.
- When you notice a problem, name it clearly: "⚠️ [problem]. Want me to fix it?"
```

**Step 5: Verify TypeScript**
```bash
npx tsc --noEmit
```

**Step 6: Commit**
```bash
git add types/index.ts components/AddActivityForm.tsx app/api/scout/chat/route.ts
git commit -m "feat(v6): persist drive distance, include in Scout trip summary, tighten bullet formatting (V6-5)"
```

---

### Task 3: V6-7 — Scout: daily drive totals + proactive driving warning

**Files:**
- Modify: `app/api/scout/chat/route.ts`

**Context:** Scout's system prompt doesn't tell it total daily drive hours per day, making it hard to proactively warn about long driving days. Add per-day cumulative drive time to the trip summary and add an explicit proactive warning instruction.

**Step 1: Add cumulative daily drive hours to trip summary**

In `buildSystemPrompt`, find the `tripSummary` block (around line 62). After building the existing `tripSummary`, modify it to include total daily drive time:

```typescript
  const tripSummary = trip.days.map(day => {
    const drives = day.activities.filter(a => a.type === 'driving');
    const totalDriveHours = drives.reduce((sum, d) => {
      const drive = d as { estimatedDriveHours?: number };
      return sum + (drive.estimatedDriveHours ?? 0);
    }, 0);
    const driveInfo = drives.map(d => {
      const drive = d as { startLocation?: { name: string }; endLocation?: { name: string }; estimatedDriveHours?: number; estimatedDriveDistance?: string };
      const hrs = drive.estimatedDriveHours ? ` (~${drive.estimatedDriveHours}h` : '';
      const dist = drive.estimatedDriveDistance ? ` · ${drive.estimatedDriveDistance}` : '';
      const suffix = (hrs || dist) ? `${hrs}${dist})` : '';
      return `${drive.startLocation?.name ?? '?'} → ${drive.endLocation?.name ?? '?'}${suffix}`;
    }).join(', ');
    const activities = day.activities.filter(a => a.type !== 'driving').map(a => a.name).join(', ');
    const totalDriveNote = totalDriveHours > 0 ? ` [${totalDriveHours.toFixed(1)}h driving total]` : '';
    return `Day ${day.dayNumber}: ${driveInfo ? `Drive ${driveInfo}` : ''}${driveInfo && activities ? ' | ' : ''}${activities || (drives.length === 0 ? 'empty' : '')}${totalDriveNote}`;
  }).join('\n');
```

**Step 2: Add proactive driving warning instruction to system prompt**

In `buildSystemPrompt`, after the existing `ROUTE CHANGE RULE` line (around line 83), add:

```
DRIVING WARNINGS: If the user's message mentions adding an activity that would require additional driving, and total daily drive time is already >= ${trip.maxDrivingHours * 0.75}h, proactively note: "⚠️ You're already at X driving hours on Day N — are you sure you want to add more?" before answering.
```

Find this line in the return template literal:
```
ROUTE CHANGE RULE: If a drive in the plan exceeds ${trip.maxDrivingHours}h...
```

Add after it:
```
DRIVING WARNING RULE: When a day's total drive time (shown in brackets as "[Xh driving total]") is >= ${Math.round(trip.maxDrivingHours * 0.75 * 10) / 10}h, proactively warn in your response before making suggestions for that day.
```

**Step 3: Verify TypeScript**
```bash
npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add app/api/scout/chat/route.ts
git commit -m "feat(v6): daily drive totals in Scout trip summary + proactive driving warning rule (V6-7)"
```

---

### Task 4: V6-3 — Widen Add Activity form

**Files:**
- Modify: `components/AddActivityForm.tsx`

**Context:** The form is currently `w-96` (384px). User wants it to take more screen — match the V4 wide modal style. The form renders inside a portal backdrop in both `Map.tsx` and `DayDetailPanel.tsx`; the form itself controls its own width.

**Step 1: Widen the root div and add 2-column layout for key fields**

In `components/AddActivityForm.tsx`, find the root return div (line 270):
```tsx
  return (
    <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
```

Change to:
```tsx
  return (
    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
```

**Step 2: Put Activity Type + Dog Friendly on same row**

Find the `Activity Type` div and the `Dog Friendly` div. Wrap them in a 2-column grid:

After the opening `<form>` tag and before `{/* Activity Type */}`, add a wrapper:
```tsx
      {/* Row: Type + Dog Friendly */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          {/* Activity Type — existing content, keep as-is */}
          <label ...>Activity Type</label>
          <select ...>...</select>
        </div>
        <div className="flex items-end pb-1">
          {/* Dog Friendly — move existing block here */}
          <label className="flex items-center">
            <input type="checkbox" checked={isDogFriendly} .../>
            <span ...>🐕 Dog-friendly</span>
          </label>
        </div>
      </div>
```

Specifically: move the existing `{/* Dog Friendly */}` section (around line 557) to be inside this 2-column grid alongside Activity Type. Delete the standalone Dog Friendly section at the bottom.

**Step 3: Put Notes + Day Assignment on same row for non-driving types**

Find `{/* Notes */}` and `{/* Day Assignment */}`. Wrap in a 2-column grid:
```tsx
      <div className="grid grid-cols-2 gap-4">
        <div>
          {/* Notes — existing textarea, keep rows={3} */}
        </div>
        <div>
          {/* Day Assignment — existing blue box */}
        </div>
      </div>
```

**Step 4: Verify TypeScript and build**
```bash
npx tsc --noEmit
npm run build
```

**Step 5: Commit**
```bash
git add components/AddActivityForm.tsx
git commit -m "feat(v6): widen Add Activity form to max-w-2xl with 2-column layout (V6-3)"
```

---

### Task 5: V6-1 — Map layers: lodging group + Select All / Deselect All

**Files:**
- Modify: `components/Map.tsx`

**Context:** The layers panel (lines 478–506 of Map.tsx) has individual checkboxes for each activity type. User wants: (1) a "Lodging" grouped toggle that controls hotel + camping together, (2) Select All and Deselect All buttons at the top of the Layers section.

**Step 1: Add Select All / Deselect All buttons**

In the layers panel, after `<p className="font-semibold text gray-700 mb-2 text-xs uppercase tracking-wide">Layers</p>`, add:

```tsx
                  <div className="flex gap-1 mb-2">
                    <button
                      onClick={() => setVisibleTypes(new Set(['trail', 'hotel', 'restaurant', 'camping', 'park', 'driving'] as ActivityType[]))}
                      className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setVisibleTypes(new Set<ActivityType>())}
                      className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      None
                    </button>
                  </div>
```

**Step 2: Add a "Lodging" grouped toggle**

In the layer checkboxes list (the `.map()` over type options), add a "Lodging" group toggle BEFORE the individual hotel/camping checkboxes. The lodging toggle checks/unchecks both hotel and camping together.

Modify the layer options array to group hotel + camping:

Replace the current flat `.map()` of all 6 types with:
```tsx
                  {/* Individual type checkboxes */}
                  {(
                    [
                      { type: 'trail', label: 'Trail', emoji: '🥾' },
                      { type: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
                      { type: 'park', label: 'Park', emoji: '🏞️' },
                      { type: 'driving', label: 'Driving', emoji: '🚗' },
                    ] as { type: ActivityType; label: string; emoji: string }[]
                  ).map(({ type, label, emoji }) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer mb-1">
                      <input
                        type="checkbox"
                        checked={visibleTypes.has(type)}
                        onChange={e => {
                          setVisibleTypes(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) { next.add(type); } else { next.delete(type); }
                            return next;
                          });
                        }}
                      />
                      <span>{emoji} {label}</span>
                    </label>
                  ))}

                  {/* Lodging group toggle */}
                  <label className="flex items-center gap-2 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={visibleTypes.has('hotel') || visibleTypes.has('camping')}
                      ref={el => {
                        if (el) el.indeterminate = visibleTypes.has('hotel') !== visibleTypes.has('camping');
                      }}
                      onChange={e => {
                        setVisibleTypes(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) { next.add('hotel'); next.add('camping'); }
                          else { next.delete('hotel'); next.delete('camping'); }
                          return next;
                        });
                      }}
                    />
                    <span>🏠 Lodging</span>
                  </label>
                  {/* Individual hotel/camping sub-checkboxes (indented) */}
                  <div className="ml-4">
                    {([{ type: 'hotel' as ActivityType, label: 'Hotel', emoji: '🏨' }, { type: 'camping' as ActivityType, label: 'Camping', emoji: '⛺' }]).map(({ type, label, emoji }) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer mb-1">
                        <input
                          type="checkbox"
                          checked={visibleTypes.has(type)}
                          onChange={e => {
                            setVisibleTypes(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) { next.add(type); } else { next.delete(type); }
                              return next;
                            });
                          }}
                        />
                        <span className="text-xs text-gray-600">{emoji} {label}</span>
                      </label>
                    ))}
                  </div>
```

**Step 3: Verify TypeScript**
```bash
npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add components/Map.tsx
git commit -m "feat(v6): map layers — lodging group toggle + Select All/None buttons (V6-1)"
```

---

### Task 6: V6-2a — DrivingActivity hover: show start & end names

**Files:**
- Modify: `components/Map.tsx`

**Context:** The existing orange DrivingActivity polylines already show `🚗 2h 15m · 143mi` on hover. User wants to also see start & end location names.

**Step 1: Update the DrivingActivity hover label**

In `Map.tsx`, find the `attachHover` function inside the driving polylines `useEffect` (around line 346). Find the line that builds the label:
```typescript
                const label = `🚗 ${element.duration?.text} · ${element.distance?.text}`;
```

Replace with:
```typescript
                const label = `🚗 ${element.duration?.text} · ${element.distance?.text}<br/><span style="font-size:11px;color:#6b7280">${drive.startLocation.name} → ${drive.endLocation.name}</span>`;
```

Also update the `showDriveTimeTooltip` content to support HTML. In the `showDriveTimeTooltip` function (around line 131):
```typescript
    driveTimeInfoWindow.current.setContent(
      `<div style="font-size:12px;padding:3px 7px;line-height:1.4;white-space:nowrap;font-family:inherit">${label}</div>`
    );
```

This already renders the `<br/>` and inner `<span>` since `setContent` accepts HTML strings.

Also update the cached label in `driveTimeCache`:
```typescript
                driveTimeCache.current.set(cacheKey, label);
```
This is fine — the cache stores the full HTML string.

**Step 2: Verify TypeScript**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add components/Map.tsx
git commit -m "feat(v6): show start & end location names on driving route hover (V6-2a)"
```

---

### Task 7: V6-2b — Day routes: add hover tooltip with drive time + activity names

**Files:**
- Modify: `components/Map.tsx`

**Context:** The day-colored dashed routes (currently drawn via `DirectionsRenderer`) have no hover support. `DirectionsRenderer` doesn't expose the underlying `Polyline` for event listeners. Refactor to draw manual Polylines from the `DirectionsResult`, enabling hover tooltips showing drive time + Day N start → end activity names.

**Step 1: Add a new ref for day route polylines**

After the existing `drivingPolylinesRef` declaration (around line 107), add:
```typescript
  // Hit-area polylines for day routes hover (replaces directionsRenderersRef)
  const dayRoutePolylinesRef = useRef<google.maps.Polyline[]>([]);
```

**Step 2: Refactor the day routes useEffect**

Find the `// Draw real-road routes between activities in each day` useEffect (starting around line 249). Replace the entire effect with:

```typescript
  // Draw real-road routes between activities in each day
  useEffect(() => {
    if (!map || !trip) return;

    // Clear previous day route polylines
    dayRoutePolylinesRef.current.forEach(p => p.setMap(null));
    dayRoutePolylinesRef.current = [];
    // Clear previous renderers (legacy cleanup)
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
      const startName = visibleActivities[0].name;
      const endName = visibleActivities[visibleActivities.length - 1].name;

      const drawDayRoute = (result: google.maps.DirectionsResult) => {
        const path = result.routes[0]?.overview_path;
        if (!path) return;

        // Calculate total drive time across all legs
        const legs = result.routes[0]?.legs ?? [];
        const totalSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);
        const totalDistance = legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
        const distMi = (totalDistance * 0.000621371).toFixed(0);
        const hoverLabel = `🚗 ${timeStr} · ${distMi} mi<br/><span style="font-size:11px;color:#6b7280">Day ${day.dayNumber}: ${startName} → ${endName}</span>`;

        // Dashed visible polyline (day color)
        const dashedLine = new google.maps.Polyline({
          path,
          geodesic: false,
          strokeColor: color,
          strokeOpacity: 0,
          strokeWeight: 0,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.65, scale: 2.5, strokeColor: color },
            offset: '0',
            repeat: '14px',
          }],
          map,
          zIndex: 1,
        });
        dayRoutePolylinesRef.current.push(dashedLine);

        // Invisible hit-area polyline for hover events
        const hitArea = new google.maps.Polyline({
          path,
          strokeColor: color,
          strokeOpacity: 0,
          strokeWeight: 12,
          map,
          zIndex: 2,
        });
        dayRoutePolylinesRef.current.push(hitArea);

        hitArea.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
          showDriveTimeTooltip(e.latLng, hoverLabel);
        });
        hitArea.addListener('mouseout', () => {
          driveTimeInfoWindow.current?.close();
        });
      };

      if (directionsCache.current.has(cacheKey)) {
        drawDayRoute(directionsCache.current.get(cacheKey)!);
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
            drawDayRoute(result);
          } else {
            console.error(`[DirectionsService] status=${status} for day ${day.dayNumber}.`);
          }
        }
      );
    });
  }, [map, trip, visibleTypes, selectedDays, showDriveTimeTooltip]);
```

**Step 3: Update the cleanup effect dependency**

The old effect used `directionsRenderersRef` for cleanup. Since we're now using `dayRoutePolylinesRef`, search for any remaining cleanup of `directionsRenderersRef` in other effects or returns, and ensure they clear `dayRoutePolylinesRef` too (the new effect already handles this in its cleanup section).

**Step 4: Verify TypeScript**
```bash
npx tsc --noEmit
```

**Step 5: Commit**
```bash
git add components/Map.tsx
git commit -m "feat(v6): day routes hover — show drive time + start/end on dashed route mouseover (V6-2b)"
```

---

### Task 8: V6-4 — Scout: suggest_add_activity tool + ScoutPanel suggestion card

**Files:**
- Modify: `app/api/scout/chat/route.ts`
- Modify: `components/ScoutPanel.tsx`

**Context:** Scout can propose route changes via `suggest_route_change`. We want Scout to also be able to suggest adding a specific activity to a specific day. This adds a new tool and a new suggestion card UI in ScoutPanel (similar to the existing route suggestion card).

**Step 1: Add `suggest_add_activity` tool to chat route**

In `app/api/scout/chat/route.ts`, after the `SUGGEST_ROUTE_CHANGE_TOOL` constant, add:

```typescript
const SUGGEST_ADD_ACTIVITY_TOOL: Anthropic.Tool = {
  name: 'suggest_add_activity',
  description:
    'Suggest adding a specific, real activity to a specific day when the user asks for recommendations or when a day is sparse. ' +
    'Only call with a real, specific place name (not generic descriptions). ' +
    'Call at most once per response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dayNumber: { type: 'number', description: 'Day number to add this activity to' },
      type: {
        type: 'string',
        enum: ['trail', 'hotel', 'restaurant', 'camping', 'park'],
        description: 'Activity type',
      },
      name: { type: 'string', description: 'Exact name of the place (e.g. "Angels Landing Trail")' },
      location: { type: 'string', description: 'City, State for geocoding (e.g. "Springdale, UT")' },
      why: { type: 'string', description: 'One sentence why this fits the trip' },
      isDogFriendly: { type: 'boolean' },
    },
    required: ['dayNumber', 'type', 'name', 'location', 'why', 'isDogFriendly'],
  },
};
```

**Step 2: Add the new tool to the Claude call**

Find the `tools` array in the `client.messages.stream` call (around line 153):
```typescript
          tools: [SUGGEST_ROUTE_CHANGE_TOOL],
```
Change to:
```typescript
          tools: [SUGGEST_ROUTE_CHANGE_TOOL, SUGGEST_ADD_ACTIVITY_TOOL],
```

**Step 3: Handle the new tool in the stream message handler**

Find the `stream.on('message', ...)` handler (around line 162). In the `for (const block of msg.content)` loop, add handling for the new tool:

```typescript
            if (block.type === 'tool_use' && block.name === 'suggest_add_activity') {
              if (!closed) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'activity_suggestion', payload: block.input })}\n\n`
                  )
                );
              }
            }
```

**Step 4: Add activity suggestion state and card to ScoutPanel**

In `components/ScoutPanel.tsx`:

Add the import for `useTrip` and geocoding (already imported via `useTrip`):
```typescript
import { geocodePlace } from '@/lib/geocoding';
import type { Activity, ActivityType, CampingSpot } from '@/types';
```

Add new state after `pendingSuggestion`:
```typescript
  interface ActivitySuggestion {
    dayNumber: number;
    type: ActivityType;
    name: string;
    location: string;
    why: string;
    isDogFriendly: boolean;
  }
  const [activitySuggestion, setActivitySuggestion] = useState<ActivitySuggestion | null>(null);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [activityAdded, setActivityAdded] = useState(false);
```

Get `addActivity` from `useTrip`:
```typescript
  const { trip, addActivity } = useTrip();
```

Add handler:
```typescript
  const handleAddSuggestedActivity = async () => {
    if (!activitySuggestion || !trip || isAddingActivity) return;
    setIsAddingActivity(true);
    try {
      const coords = await geocodePlace(`${activitySuggestion.name}, ${activitySuggestion.location}`);
      if (!coords) { setIsAddingActivity(false); return; }
      const activity: Activity = {
        id: crypto.randomUUID(),
        type: activitySuggestion.type,
        name: activitySuggestion.name,
        coordinates: coords,
        dayNumber: activitySuggestion.dayNumber,
        isDogFriendly: activitySuggestion.isDogFriendly,
        notes: activitySuggestion.why,
        ...(activitySuggestion.type === 'camping' ? {
          amenities: { free: false, fireRing: false, cellCoverage: false, water: false },
        } as Partial<CampingSpot> : {}),
      } as Activity;
      addActivity(activity);
      setActivityAdded(true);
      setTimeout(() => { setActivitySuggestion(null); setActivityAdded(false); }, 2000);
    } finally {
      setIsAddingActivity(false);
    }
  };
```

Handle the new SSE event type in the stream reader (find the `parsed.type === 'route_suggestion'` check and add after it):
```typescript
              if (parsed.type === 'activity_suggestion' && parsed.payload) {
                setActivitySuggestion(parsed.payload as ActivitySuggestion);
                setActivityAdded(false);
                continue;
              }
```

**Step 5: Add activity suggestion card in ScoutPanel JSX**

After the route suggestion card block (lines 165-180), add:
```tsx
        {/* Activity Suggestion Card */}
        {activitySuggestion && (
          <div className="mx-3 mb-2 border border-green-200 rounded-lg bg-green-50 p-3">
            <p className="text-xs font-semibold text-green-800 mb-0.5">
              ➕ Day {activitySuggestion.dayNumber}: {activitySuggestion.name}
            </p>
            <p className="text-xs text-green-700 mb-2">{activitySuggestion.why}</p>
            <div className="flex gap-2">
              <button
                onClick={handleAddSuggestedActivity}
                disabled={isAddingActivity || activityAdded}
                className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded-md hover:bg-green-700 disabled:opacity-60"
              >
                {activityAdded ? '✓ Added!' : isAddingActivity ? 'Adding…' : `+ Add to Day ${activitySuggestion.dayNumber}`}
              </button>
              <button
                onClick={() => setActivitySuggestion(null)}
                className="flex-1 bg-white text-gray-600 text-xs py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
```

**Step 6: Verify TypeScript**
```bash
npx tsc --noEmit
```

**Step 7: Commit**
```bash
git add app/api/scout/chat/route.ts components/ScoutPanel.tsx
git commit -m "feat(v6): Scout can suggest activities to add via chat with one-click add (V6-4)"
```

---

### Task 9: V6-8 — Preference profile modal ("Customer Traits")

**Files:**
- Modify: `types/index.ts`
- Create: `components/PreferencesModal.tsx`
- Modify: `components/TopNav.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/store.tsx`
- Modify: `app/api/scout/chat/route.ts`

**Context:** Add a preference system where users rate their interest in activity types (1–5) and add custom interest tags (e.g., "crossfit", "craft beer"). These preferences feed into Scout's recommendations.

**Step 1: Add TripPreferences type to types/index.ts**

After the `MustHave` interface, add:
```typescript
export interface TripPreferences {
  hiking: number;      // 1-5 (0 = not rated)
  museums: number;     // 1-5
  wineries: number;    // 1-5
  shopping: number;    // 1-5
  restaurants: number; // 1-5
  outdoorAdventure: number; // 1-5
  customInterests: string[]; // e.g., ["crossfit", "craft beer"]
}
```

Add to `Trip` interface (after `mustHaves`):
```typescript
  // Step 7: Preferences (optional)
  preferences?: TripPreferences;
```

**Step 2: Add updatePreferences to store**

In `lib/store.tsx`, add to `TripContextType`:
```typescript
  updatePreferences: (prefs: Partial<import('@/types').TripPreferences>) => void;
```

Add implementation in `TripProvider` (after other mutation handlers):
```typescript
  const updatePreferences = useCallback((prefs: Partial<TripPreferences>) => {
    setTrip(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        preferences: { ...prev.preferences, ...prefs, customInterests: prefs.customInterests ?? prev.preferences?.customInterests ?? [] },
      } as Trip;
      return updated;
    });
  }, []);
```

Export `updatePreferences` in the context value.

**Step 3: Create PreferencesModal component**

Create `components/PreferencesModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTrip } from '@/lib/store';
import type { TripPreferences } from '@/types';

interface Props {
  onClose: () => void;
}

const INTEREST_FIELDS: { key: keyof Omit<TripPreferences, 'customInterests'>; label: string; emoji: string }[] = [
  { key: 'hiking', label: 'Hiking & Trails', emoji: '🥾' },
  { key: 'museums', label: 'Museums & History', emoji: '🏛️' },
  { key: 'wineries', label: 'Wineries & Breweries', emoji: '🍷' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { key: 'restaurants', label: 'Food & Dining', emoji: '🍽️' },
  { key: 'outdoorAdventure', label: 'Outdoor Adventure', emoji: '🏔️' },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          className={`text-xl transition-colors ${n <= value ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function PreferencesModal({ onClose }: Props) {
  const { trip, updatePreferences } = useTrip();
  const prefs = trip?.preferences;
  const [ratings, setRatings] = useState<Omit<TripPreferences, 'customInterests'>>({
    hiking: prefs?.hiking ?? 0,
    museums: prefs?.museums ?? 0,
    wineries: prefs?.wineries ?? 0,
    shopping: prefs?.shopping ?? 0,
    restaurants: prefs?.restaurants ?? 0,
    outdoorAdventure: prefs?.outdoorAdventure ?? 0,
  });
  const [customInput, setCustomInput] = useState('');
  const [customInterests, setCustomInterests] = useState<string[]>(prefs?.customInterests ?? []);

  const handleSave = () => {
    updatePreferences({ ...ratings, customInterests });
    onClose();
  };

  const addCustomInterest = () => {
    const tag = customInput.trim().toLowerCase();
    if (tag && !customInterests.includes(tag)) {
      setCustomInterests(prev => [...prev, tag]);
    }
    setCustomInput('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Your Interests</h2>
            <p className="text-sm text-gray-500">Scout uses these to personalize recommendations</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {INTEREST_FIELDS.map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{emoji} {label}</span>
              <StarRating
                value={ratings[key]}
                onChange={v => setRatings(prev => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Other interests</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomInterest(); } }}
                placeholder="e.g., crossfit, craft beer, photography"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                type="button"
                onClick={addCustomInterest}
                className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-orange-600"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {customInterests.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                  {tag}
                  <button onClick={() => setCustomInterests(prev => prev.filter(t => t !== tag))} className="hover:text-orange-900 leading-none">✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t p-4 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600">Save Preferences</button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Add Preferences button to TopNav**

In `components/TopNav.tsx`, find the existing buttons (Scout, Dashboard, Import). Read the file first, then add an `onPreferences` prop and a "⭐ Interests" button next to the others.

**Step 5: Wire PreferencesModal in app/page.tsx**

Add `showPreferences` state, import `PreferencesModal`, add `onPreferences` to `TopNav`, render `{showPreferences && <PreferencesModal onClose={...} />}`.

**Step 6: Add preferences to Scout system prompt**

In `app/api/scout/chat/route.ts` `buildSystemPrompt`, after the `USER PREFERENCES` section, add:
```typescript
  const prefsSection = trip.preferences ? `
USER INTERESTS (use to personalize recommendations):
${INTEREST_FIELDS_LABELS.filter(f => trip.preferences![f.key] > 0).map(f => `- ${f.label}: ${'★'.repeat(trip.preferences![f.key])}${'☆'.repeat(5 - trip.preferences![f.key])}`).join('\n')}
${trip.preferences.customInterests?.length ? `- Also enjoys: ${trip.preferences.customInterests.join(', ')}` : ''}` : '';
```

Note: define `INTEREST_FIELDS_LABELS` as a simple const array in the route file.

**Step 7: Verify TypeScript and build**
```bash
npx tsc --noEmit
npm run build
```

**Step 8: Commit**
```bash
git add types/index.ts components/PreferencesModal.tsx components/TopNav.tsx app/page.tsx lib/store.tsx app/api/scout/chat/route.ts
git commit -m "feat(v6): preference profile modal — interest ratings + custom tags, feeds Scout (V6-8)"
```

---

## Verification Checklist

After all tasks, spot-check in dev server (`npm run dev`, localhost:3001):

1. **V6-6:** Open Scout panel → try scrolling the day list in Sidebar — it should scroll freely
2. **V6-5:** Add a driving activity → verify distance is saved; open Scout and ask about the drive — it should cite correct distance; Scout responses should be bullets
3. **V6-7:** Open Scout on a trip with a long drive day — Scout should proactively warn
4. **V6-3:** Click "+ Add Activity" → form should be wider (max-w-2xl)
5. **V6-1:** Open map layers panel → "All"/"None" buttons work; "Lodging" checkbox toggles hotel+camping together
6. **V6-2a:** Hover over an orange driving route → should show "🚗 X · Y mi" + start/end names
7. **V6-2b:** Hover over day-colored dashed route → should show drive time + Day N: A → B
8. **V6-4:** Chat with Scout and ask for a recommendation → Scout should show a green suggestion card with "+ Add" button
9. **V6-8:** Click "⭐ Interests" in TopNav → modal opens with star ratings + custom tags → save → Scout recommendations improve

## Files Changed Summary

| File | Tasks |
|------|-------|
| `components/ScoutPanel.tsx` | V6-6, V6-4 |
| `app/api/scout/chat/route.ts` | V6-5, V6-7, V6-4, V6-8 |
| `types/index.ts` | V6-5, V6-8 |
| `components/AddActivityForm.tsx` | V6-5, V6-3 |
| `components/Map.tsx` | V6-1, V6-2a, V6-2b |
| `lib/store.tsx` | V6-8 |
| `components/PreferencesModal.tsx` | V6-8 (new) |
| `components/TopNav.tsx` | V6-8 |
| `app/page.tsx` | V6-8 |
