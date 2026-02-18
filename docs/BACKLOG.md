# Road Trip Planner — Feature Backlog

> **Plan file:** `docs/plans/2026-02-18-option-c-hybrid.md`
> **v2 Design doc:** `docs/plans/2026-02-18-v2-features-design.md`
> **Dashboard:** `status.json`
> **Last updated:** 2026-02-18

---

## How to Use This Backlog

- Status: `🔲 pending` | `🔄 in progress` | `✅ done` | `🚫 blocked`
- Assign tasks to subagents by setting the **Assigned** column
- After completing a task, update status here AND in `status.json`

---

## v2 Phase A: Critical Fixes (Do First)

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| V2-A1 | Navigation fix — add TopNav bar to map view | 🔲 pending | — | Fixes dead-end bug; add ← Home + Import button + Dashboard button. Files: `app/page.tsx`, `components/TopNav.tsx` |

---

## v2 Phase B: Scout AI Assistant

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| V2-B1 | Create Supabase `scout_messages` table | 🔲 pending | — | `(id, trip_id, role, content, created_at)` — can run parallel with B2/B3 |
| V2-B2 | `POST /api/scout/chat` — streaming chat with trip context | 🔲 pending | — | claude-sonnet-4-6, full trip JSON in system prompt, streamed. File: `app/api/scout/chat/route.ts` |
| V2-B3 | `POST /api/scout/tips` — proactive tips | 🔲 pending | — | claude-haiku-4-5-20251001, returns tip array. File: `app/api/scout/tips/route.ts` |
| V2-B4 | `ScoutPanel.tsx` — sliding chat drawer | 🔲 pending | — | Floating button (bottom-right), drawer w-96, message history, streamed responses. Depends on V2-B2 |
| V2-B5 | `ScoutTip.tsx` + Sidebar wiring — proactive tip callouts | 🔲 pending | — | Dismissible callouts above day list in Sidebar, debounced 3s trigger. Depends on V2-B3 |

---

## v2 Phase C: DayDetailPanel Enhancements

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| V2-C1 | Add `showOnMap?: boolean` to `Activity` type | 🔲 pending | — | `types/index.ts` — default true when undefined. Prereq for C2/C3 |
| V2-C2 | Drag-and-drop activity reorder in DayDetailPanel | 🔲 pending | — | Install `@hello-pangea/dnd`, wrap list in DragDropContext. Calls existing `reorderActivities()`. Files: `DayDetailPanel.tsx` |
| V2-C3 | Show/hide map toggle per activity in DayDetailPanel | 🔲 pending | — | 👁 toggle button per row, calls `updateActivity`. Files: `DayDetailPanel.tsx`, `Map.tsx`, `lib/store.tsx` |

---

## v2 Phase D: Map Layer Filters + Route Hover

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| V2-D1 | Map layer filter controls | 🔲 pending | — | Overlay panel top-right: Activity/Driving/Lodging toggles + day multi-select chips. Local state only. File: `Map.tsx` |
| V2-D2 | Route hover — drive time via Distance Matrix API | 🔲 pending | — | Polyline mouseover → fetch Distance Matrix → tooltip "🚗 2h 15m · 143mi". Cache in useRef. File: `Map.tsx` |

---

## v2 Phase E: Wizard Preset Validation

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| V2-E1 | Add wizard preset rules to `lib/validation.ts` | 🔲 pending | — | maxDrivingHours, hasDog+notDogFriendly, tripPace vs activity count. Existing badges auto-render. |

---

## v2 Phase F: Dashboard Stats Panel (Lowest Priority)

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| V2-F1 | `DashboardModal.tsx` — stats panel | 🔲 pending | — | Full-screen modal: Trip Overview, Driving Summary, Lodging, Dog Status, Validation, Weather. Each card clickable to detail modal. |
| V2-F2 | Wire Dashboard button to nav bar | 🔲 pending | — | Add 📊 Dashboard button to `TopNav.tsx`. Depends on V2-A1 + V2-F1 |

---

## Phase 0: Activity Form Foundations (P0) — COMPLETE ✅

| ID | Task | Status | Assigned | Notes |
|----|------|--------|----------|-------|
| P0-TA | Google Places Autocomplete for name/location fields | ✅ done | subagent-1 | `PlacesAutocomplete.tsx` + `AddActivityForm.tsx` |
| P0-TB | Driving activity type (start + finish locations) | ✅ done | subagent-2 | All 5 files, spec verified |
| P0-TC | Fix pre-existing ESLint errors in wizard + storage files | ✅ done | main | commit d7de8da — clean build restored |

---

## Phase 1: Core UX Gaps (P1) — COMPLETE ✅

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P1-T1 | Dog/No-Dog day badge on DayCard | ✅ done | commit 9b0c0f3 |
| P1-T2 | Day Detail Panel | ✅ done | commit b23d18f |
| P1-T3 | Add Activity from Day Panel + Geocoding | ✅ done | commit 61398c4 |

---

## Phase 2: Smart AI Import (P2) — COMPLETE ✅

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P2-T4 | Install @anthropic-ai/sdk + ANTHROPIC_API_KEY | ✅ done | |
| P2-T5 | AI Import API route (`/api/import`) | ✅ done | commit 00a1d22 |
| P2-T6 | Import modal UI (`ImportItinerary.tsx`) | ✅ done | commit 2cf3818 |
| P2-T7 | Homepage "Import Existing Plan" CTA | ✅ done | commit 0c57197 |

---

## Phase 3: Intelligence Layer (P3) — COMPLETE ✅

| ID | Task | Status | Notes |
|----|------|--------|-------|
| P3-T8 | Weather badges on DayCard | ✅ done | commits ea36c1f, e823f84 |
| P3-T9 | Validation UI in DayCard + DayDetailPanel | ✅ done | commits 982b4f4, 182ea17, 9c37022 |
| P3-T10 | Map auto-fits to selected day's activities | ✅ done | commit 7f383a3 |

---

## Previously Completed (Foundation)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| OLD-1 | Fix map loading deadlock (mapRef null) | ✅ done | commit 1a2da0b |
| OLD-2 | Build Weather.gov API utility (`lib/weather.ts`) | ✅ done | commit eace5fc |
| OLD-3 | Build lodging validation engine (`lib/validation.ts`) | ✅ done | commit eace5fc |
| OLD-4 | Add Supabase backend for persistent trip storage | ✅ done | commit 221746d |
| OLD-5 | Fix Google Maps: bypass broken js-api-loader v2 | ✅ done | commit 62f343d |
| OLD-6 | 6-step wizard redesign with homepage and My Trips page | ✅ done | commit 6f3a877 |

---

## v2 Dependency Map

```
V2-A1 (nav fix)
    └── unblocks: V2-F2

V2-B1 (Supabase table)
    └── unblocks: V2-B4 (chat history persistence)

V2-B2 (chat API)
    └── unblocks: V2-B4 (ScoutPanel)

V2-B3 (tips API)
    └── unblocks: V2-B5 (tip callouts)

V2-B4 (ScoutPanel)
    └── depends on: V2-B2

V2-B5 (tip callouts)
    └── depends on: V2-B3

V2-C1 (showOnMap type)
    └── unblocks: V2-C2, V2-C3

V2-C2 (drag-and-drop)
    └── depends on: V2-C1

V2-C3 (show/hide toggle)
    └── depends on: V2-C1

V2-D1, V2-D2, V2-E1
    └── independent

V2-F1 (Dashboard modal)
    └── independent

V2-F2 (Dashboard nav button)
    └── depends on: V2-A1, V2-F1
```

---

## Deferred to Future Phase

| ID | Feature | Reason |
|----|---------|--------|
| FUT-1 | Google Directions travel time per day | Now handled by route hover (V2-D2) |
| FUT-2 | Print / export itinerary | Post-MVP |
| FUT-4 | Photo attachments to activities | Post-MVP |
| FUT-5 | Reservation tracker (confirmation numbers) | Post-MVP |
| FUT-6 | Native mobile app | Post-MVP |
| FUT-7 | Offline mode | Post-MVP |
