# Road Trip Planner — Feature Backlog

> **Plan file:** `docs/plans/2026-02-18-option-c-hybrid.md`
> **Dashboard:** `status.json`
> **Last updated:** 2026-02-18

---

## How to Use This Backlog

- Status: `🔲 pending` | `🔄 in progress` | `✅ done` | `🚫 blocked`
- Assign tasks to subagents by setting the **Assigned** column
- After completing a task, update status here AND in `status.json`

---

## Phase 0: Activity Form Foundations (P0) — Do Before Everything Else

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| P0-TA | Google Places Autocomplete for name/location fields | 🔲 pending | — | Create `components/PlacesAutocomplete.tsx`, modify `AddActivityForm.tsx` |
| P0-TB | Driving activity type (start + finish locations) | 🔲 pending | — | Modify `types/index.ts`, `AddActivityForm.tsx`, `DayCard.tsx`, `Map.tsx` — depends on P0-TA |

**Definition of done (Phase 0):**
- [ ] Typing a place name in AddActivityForm shows a live Google Places dropdown
- [ ] Selecting a suggestion auto-fills name AND resolves coordinates (no map click required)
- [ ] "Driving" is a selectable activity type
- [ ] Driving form shows two Places Autocomplete inputs: Start Location and End Location
- [ ] Activity name auto-generates as "Drive: [Start] → [End]"
- [ ] Map shows dashed polyline between start and end for driving activities
- [ ] DayCard shows 🚗 icon for driving activities

---

## Phase 1: Core UX Gaps (P0) — Do First

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| P1-T1 | Dog/No-Dog day badge on DayCard | 🔲 pending | — | Modify `components/DayCard.tsx` |
| P1-T2 | Day Detail Panel (expandable from DayCard) | 🔲 pending | — | Create `components/DayDetailPanel.tsx`, modify `Sidebar.tsx` |
| P1-T3 | Add Activity from Day Panel + Geocoding utility | 🔲 pending | — | Create `lib/geocoding.ts`, modify `AddActivityForm.tsx` |

**Definition of done (Phase 1):**
- [ ] Clicking a day expands a detail panel showing activities in a timeline
- [ ] Each DayCard has a 🐕 / 🚫 badge based on activity dog-friendliness
- [ ] "Add Activity" button in panel opens form with place-name search (geocoding)
- [ ] Activities added via day panel appear as pins on the map

---

## Phase 2: Smart AI Import (P1)

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| P2-T4 | Install @anthropic-ai/sdk + add ANTHROPIC_API_KEY to .env.local | 🔲 pending | — | Needs API key from user |
| P2-T5 | AI Import API route (`/api/import`) | 🔲 pending | — | Create `app/api/import/route.ts`, uses claude-haiku-4-5 |
| P2-T6 | Import modal UI (`ImportItinerary.tsx`) | 🔲 pending | — | Two tabs: paste text / paste spreadsheet |
| P2-T7 | Homepage "Import Existing Plan" CTA | 🔲 pending | — | Modify `Homepage.tsx` + `app/page.tsx` |

**Definition of done (Phase 2):**
- [ ] "Import Existing Plan" button visible on homepage
- [ ] Pasting free-form trip notes → AI extracts days/activities/dates
- [ ] Pasting spreadsheet data → same AI extraction
- [ ] Preview screen shows parsed result before applying
- [ ] Applying geocodes all activity names and populates the map

---

## Phase 3: Intelligence Layer (P2)

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| P3-T8 | Weather badges on DayCard (wire existing engine) | 🔲 pending | — | Modify `lib/store.tsx` + `DayCard.tsx` |
| P3-T9 | Validation UI in DayCard + DayDetailPanel (wire existing engine) | 🔲 pending | — | Modify `lib/store.tsx` + `DayCard.tsx` |
| P3-T10 | Map auto-fits to selected day's activities | 🔲 pending | — | Modify `components/Map.tsx` |

**Definition of done (Phase 3):**
- [ ] Weather forecast badge (🌧️ 58°) visible on each DayCard that has activities
- [ ] 🔴/🟡/🟢 validation dot on DayCard when conflicts exist
- [ ] DayDetailPanel shows full validation messages (e.g. "Dog can't be left at campsite")
- [ ] Selecting a day in sidebar animates map to fit that day's route

---

## Previously Completed (from prior sessions)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| OLD-1 | Fix map loading deadlock (mapRef null) | ✅ done | commit 1a2da0b |
| OLD-2 | Build Weather.gov API utility (`lib/weather.ts`) | ✅ done | commit eace5fc |
| OLD-3 | Build lodging validation engine (`lib/validation.ts`) | ✅ done | commit eace5fc |
| OLD-4 | Add Supabase backend for persistent trip storage | ✅ done | commit 221746d |
| OLD-5 | Fix Google Maps: bypass broken js-api-loader v2 | ✅ done | commit 62f343d |
| OLD-6 | 6-step wizard redesign with homepage and My Trips page | ✅ done | commit 6f3a877 |

---

## Deferred to Future Phase

| ID | Feature | Reason |
|----|---------|--------|
| FUT-1 | Google Directions travel time per day | P2 PRD item, not blocking |
| FUT-2 | Print / export itinerary | P2 PRD item, not blocking |
| FUT-3 | AI conversational planning assistant (chat) | Post-MVP |
| FUT-4 | Photo attachments to activities | Post-MVP |
| FUT-5 | Reservation tracker (confirmation numbers) | Post-MVP |
| FUT-6 | Native mobile app | Post-MVP |
| FUT-7 | Offline mode | Post-MVP |

---

## Dependency Map

```
P1-T1 (dog badge)
    └── can ship standalone

P1-T2 (day detail panel)
    └── depends on: P1-T1 (dog badge logic reused)

P1-T3 (geocoding + add from panel)
    └── depends on: P1-T2 (panel has the add button)

P2-T4 (install SDK)
    └── must be first in Phase 2

P2-T5 (import API)
    └── depends on: P2-T4

P2-T6 (import modal)
    └── depends on: P2-T5, P1-T3 (geocoding)

P2-T7 (homepage CTA)
    └── depends on: P2-T6

P3-T8/T9/T10
    └── independent, can run in parallel with Phase 2
```
