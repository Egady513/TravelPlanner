# V3 Features Design
**Date:** 2026-02-24
**Status:** Approved

## Overview

Six features across three areas: data model improvements (multi-night stays), AI-powered day planning tools (optimize order, activity recommendations, plan a day), and map UX (typed icons).

Flight activity type deferred to future sprint.

---

## Feature 1: Multi-night Stay Auto-populate

### Data Model

Add to base `Activity` type in `types/index.ts`:
```typescript
isContinuingStay?: boolean;
sourceActivityId?: string;  // points to the original activity's id
parentDayNumber?: number;   // which day the original stay is on
```

### Store Behavior (`lib/store.tsx`)

`addActivity`: after adding the primary activity, check if `type === 'hotel' || type === 'camping'` and `nights > 1`. If so, create copies for days `dayNumber+1` through `dayNumber+(nights-1)` — only for days that already exist in `trip.days`. Copies are identical except `isContinuingStay: true`, `sourceActivityId: originalActivity.id`, `parentDayNumber: originalDayNumber`.

`removeActivity`: after removing the target, also filter out all activities where `sourceActivityId === removedId`. Cascade is automatic.

### UI

- DayCard + DayDetailPanel: continuing stays render with muted gray background, italic name ("🏨 Continuing stay from Day 2"), no drag handle, no remove button in DayCard view
- DayDetailPanel: continuing stays can still be individually removed via the ✕ button
- Dashboard: lodging count and cost skip `isContinuingStay` activities (cost lives in primary activity's `nights` field)

---

## Feature 2: Optimize Order

### API Route
`POST /api/scout/optimize-day`

**Request:**
```json
{ "day": Day, "trip": Trip }
```

**Response:**
```json
{ "order": ["id3", "id1", "id2"], "reasoning": "Hit the trail early before heat, lunch after, hotel check-in last." }
```

**Model:** `claude-haiku-4-5-20251001` (speed over power, structured output)

**Prompt:** Claude receives activity names, types, coordinates, notes, trip pace, dog status. Reasons contextually: strenuous trails in morning, meals at logical times, hotel/camping check-in last, driving where geographically sensible.

### UI

- Button **"✨ Optimize Order"** in DayDetailPanel header, visible only when day has 2+ activities
- Loading state: button disabled with spinner
- On success: calls `reorderActivities`, shows dismissible toast with `reasoning` for ~5 seconds below activity list

---

## Feature 3: Activity Recommendations

### API Route
`POST /api/scout/recommend-activities`

**Request:**
```json
{ "type": ActivityType, "day": Day, "trip": Trip }
```

**Response:**
```json
{
  "suggestions": [
    { "name": "Two Medicine Lake Trail", "location": "Glacier National Park, MT", "why": "Less crowded than Highline, dog-friendly, doable in 3h" }
  ]
}
```

**Model:** `claude-haiku-4-5-20251001`

**Count:** 3–5 suggestions per request

**Post-processing:** Each suggestion geocoded via existing `geocodePlace(name + ', ' + location)`. Failed geocoding shows warning but still allows manual add.

### UI

- Button **"Find Activities"** in DayDetailPanel footer (above "Add Activity" CTA)
- Click opens inline panel within the detail panel: 5 activity type icon buttons
- User picks type → loading state → results render as cards
- Each card: activity name, Scout's one-line `why`, small location label, **"+ Add"** button
- Clicking Add: calls `addActivity` with geocoded coords, closes panel

---

## Feature 4: Plan a Day

### API Route
`POST /api/scout/plan-day`

**Request:**
```json
{ "day": Day, "trip": Trip }
```

**Response:**
```json
{
  "activities": [
    { "type": "trail", "name": "Hidden Lake Trail", "location": "Glacier NP, MT", "why": "Morning before crowds", "isDogFriendly": true }
  ]
}
```

**Model:** `claude-haiku-4-5-20251001`

**Count:** 3–6 activities. If day has existing activities, Claude works around them and fills gaps. Considers trip pace, dog status, budget, day location.

**Post-processing:** All suggestions geocoded in parallel.

### UI

- Button **"Plan This Day"** in DayDetailPanel footer, next to "Find Activities"
- Loading state: full-panel overlay "Scout is planning your day…" during Claude call + geocoding
- On success: opens `PlanDayModal` (new component, similar to `RouteChangeModal`)
  - Shows proposed activities as checklist, all pre-checked
  - User deselects unwanted items
  - **"Add Selected"** button: calls `addActivity` for each checked item, closes modal
  - **"Cancel"** dismisses

---

## Feature 5: Map Icons (AdvancedMarkerElement)

### Migration

Replace `new google.maps.Marker(...)` with `new google.maps.marker.AdvancedMarkerElement(...)` in `components/Map.tsx`. The `marker` library is already included in the Maps API loader URL.

### Icon Element

Each marker renders an HTML `div`:
```html
<div style="
  width:32px; height:32px;
  background: COLOR;
  border-radius: 50%;
  border: 2px solid white;
  display:flex; align-items:center; justify-content:center;
  font-size:16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
">EMOJI</div>
```

Emoji map (matches existing `activityIcons` in DayDetailPanel):
- trail → 🥾 (green `#10b981`)
- hotel → 🏨 (blue `#3b82f6`)
- restaurant → 🍽️ (orange `#f97316`)
- camping → ⛺ (brown `#92400e`)
- park → 🏞️ (dark green `#059669`)
- driving → 🚗 (gray `#6b7280`)

### Behavior Preserved

- Click → info window (unchanged)
- `showOnMap === false` → marker hidden (unchanged)
- Selected day's markers highlighted (existing ring logic preserved)

---

## Implementation Order

1. Multi-night auto-populate (data model + store + UI)
2. Map icons (self-contained, no dependencies)
3. Optimize order API + UI
4. Activity recommendations API + UI
5. Plan a day API + UI (new `PlanDayModal`)
