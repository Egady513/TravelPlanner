# V4 UX Improvements — Design Doc

**Date:** 2026-02-25
**Status:** Approved

## Overview

Seven targeted UX improvements across the map, day detail panel, activity management, and AI feedback surfaces.

---

## 1. Map Layer Filters — Per-Type Toggles

**Problem:** The current 3-bucket system (Activities / Driving / Lodging) lumps camping and park together with trail/restaurant, and puts camping in a different bucket from hotel.

**Design:** Replace with 6 individual type toggles, each with its emoji:
- 🥾 Trail
- 🏨 Hotel
- 🍽️ Restaurant
- ⛺ Camping
- 🏞️ Park
- 🚗 Driving

**Implementation:** Replace `showActivities: boolean` and `showLodging: boolean` state with `visibleTypes: Set<ActivityType>` (all enabled by default). Filter logic reads `visibleTypes.has(activity.type)` instead of the bucket checks. UI renders 6 checkboxes.

**File:** `components/Map.tsx`

---

## 2. Day Detail Panel — Wide Overlay Modal

**Problem:** The `w-80` sidebar is too narrow for validation messages, badges, action buttons, and the activity list to coexist readably.

**Design:** Replace the fixed sidebar with a centered overlay modal (`max-w-3xl`, ~75% screen width, up to 85vh tall, dark backdrop). Two-column layout:

- **Left col (~60%):** Scrollable activity list with DnD drag handles. Each activity row is clickable to open the edit form.
- **Right col (~40%):** Day header (date, day number), status badges (dog status, weather, validation messages — now have room to stack), Optimize button, and a collapsible "Find Activities" section.

The modal is opened the same way as before (clicking a day in the sidebar). Closing returns to the map view.

**Files:** `components/DayDetailPanel.tsx`, `app/page.tsx`

---

## 3. Activity Edit — Pre-filled Form

**Problem:** Users must delete and re-add an activity to change any field.

**Design:** Clicking an activity row in the day detail modal opens `AddActivityForm` pre-populated with the activity's existing values. On submit, calls `updateActivity` instead of `addActivity`.

**Implementation:**
- Add `existingActivity?: Activity` prop to `AddActivityForm`
- When present: initialize all state from existing activity fields, show "Save Changes" button instead of "Add Activity", call `updateActivity(existingActivity.id, updatedFields)` on submit
- In `DayDetailPanel`: add `editingActivity: Activity | null` state; clicking a row sets it; renders `AddActivityForm` as a second overlay on top of the day modal

**Files:** `components/AddActivityForm.tsx`, `components/DayDetailPanel.tsx`

---

## 4. Places Autocomplete — Trip-Region Location Bias

**Problem:** Google Places defaults suggestions to the user's physical location, not where the trip is happening.

**Design:** Add an optional `locationBias?: google.maps.LatLngBounds | google.maps.LatLng` prop to `PlacesAutocomplete`. Pass it to the `Autocomplete` constructor as the `bounds` option. In `AddActivityForm`, compute the bias from existing trip activities:

1. If the trip has ≥1 existing activity with coordinates → compute a `LatLngBounds` that encompasses all of them and use that.
2. Else if `trip.startingLocation.coordinates` exists → use that as a `LatLng` point.
3. Else → no bias (current behavior).

The bias is a soft hint to Google, not a hard restriction. Results outside the bounds still appear but are ranked lower.

**Files:** `components/PlacesAutocomplete.tsx`, `components/AddActivityForm.tsx`

---

## 5. Optimize Order — Better Feedback

**Problem:** Optimize silently succeeds or fails. Users can't tell if anything changed.

**Design:**
- **No change detected:** If Scout returns the same order as the current order, show toast: `"✨ Already in great shape — no changes needed"`
- **Reordered:** Show the new sequence in the toast: `"✨ Reordered: 1. Trail → 2. Lunch spot → 3. Campsite"` (truncated to 3 names if more)
- **Error:** Existing error message is fine
- Bump auto-dismiss from 6s to 10s
- Slightly bolder toast border (`border-2 border-orange-300`)

**File:** `components/DayDetailPanel.tsx`

---

## 6. Find Activities Panel — Wire Up Button

**Problem:** `RecommendActivitiesPanel` is implemented but never rendered — no button exists to open it.

**Design:** In the right column of the new day detail modal, add a "🔍 Find Activities" button below the Optimize button. Clicking it toggles `showRecommend: boolean` state, which renders `RecommendActivitiesPanel` below (inside the right column, scrollable). The panel's own close button sets `showRecommend` back to false.

**Files:** `components/DayDetailPanel.tsx`

---

## 7. Drive Time Tooltip — Tighter Styling (Low Priority)

**Problem:** Google Maps `InfoWindow` has generous default padding that creates excess whitespace.

**Design:** Override the InfoWindow content with tighter inline styles:
```html
<div style="font-size:12px;padding:3px 7px;line-height:1.4;white-space:nowrap;font-family:inherit">
  🚗 2h 15m · 143 mi
</div>
```

This is a cosmetic improvement only. We cannot fully eliminate the InfoWindow chrome without switching to a custom overlay, which is out of scope.

**File:** `components/Map.tsx`

---

## Task Summary

| ID | Task | Files |
|----|------|-------|
| V4-1 | Map layer per-type toggles | `Map.tsx` |
| V4-2 | Day detail overlay modal (wide, 2-col) | `DayDetailPanel.tsx`, `page.tsx` |
| V4-3 | Activity edit (pre-filled form) | `AddActivityForm.tsx`, `DayDetailPanel.tsx` |
| V4-4 | Places autocomplete location bias | `PlacesAutocomplete.tsx`, `AddActivityForm.tsx` |
| V4-5 | Optimize feedback improvements | `DayDetailPanel.tsx` |
| V4-6 | Wire Find Activities button | `DayDetailPanel.tsx` |
| V4-7 | Drive time tooltip tighter style | `Map.tsx` |

## Dependencies

```
V4-2 (modal) must land before V4-3 (edit), V4-5 (optimize), V4-6 (find activities)
  — all three modify DayDetailPanel and assume the new modal layout

V4-1, V4-4, V4-7 are independent
```
