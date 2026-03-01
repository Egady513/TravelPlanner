# Road Trip Planner — Feature Backlog

> **Plan file:** `docs/plans/2026-02-18-option-c-hybrid.md`
> **v2 Design doc:** `docs/plans/2026-02-18-v2-features-design.md`
> **Dashboard:** `status.json`
> **Last updated:** 2026-02-27

---

## How to Use This Backlog

- Status: `🔲 pending` | `🔄 in progress` | `✅ done` | `🚫 blocked`
- Assign tasks to subagents by setting the **Assigned** column
- After completing a task, update status here AND in `status.json`

---

## V6 Sprint — Map Routes, Scout Polish, Preference Profile (Up Next)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| V6-1 | Map layers: lodging type + select/deselect all | 🔲 pending | Show hotel/camping pin in layers panel. Add "Select All" and "Deselect All" buttons to layer toggles. `components/Map.tsx` |
| V6-2 | Map: drive routes between activities with hover | 🔲 pending | Draw polyline between consecutive activities in day order. Hover shows drive time + start/end location names. Based on activity order from day planner. `components/Map.tsx`, Distance Matrix API |
| V6-3 | Add Activity form: wider / more screen space | 🔲 pending | The AddActivityForm should use more of the screen (match V4 wide modal style). `components/AddActivityForm.tsx` |
| V6-4 | Scout: add activities to itinerary from chat | 🔲 pending | Scout should be able to suggest & add activities via chat (tool use or structured response). |
| V6-5 | Scout: fix wrong distance in chat + bullet formatting | 🔲 pending | Bug: Scout reports wrong drive distance in chat. Also: force Scout to use bullets/lists, never full paragraphs. `app/api/scout/chat/route.ts` |
| V6-6 | Scout: can't scroll itinerary while Scout panel open | 🔲 pending | Layout bug — Scout panel blocks scrolling of day list. `components/ScoutPanel.tsx`, `app/page.tsx` |
| V6-7 | Scout: proactive driving warnings in chat | 🔲 pending | Scout should warn when cumulative driving exceeds maxDrivingHours or when adding a long drive ("you've driven a lot today — are you sure?"). |
| V6-8 | Preference profile ("Customer Traits") | 🔲 pending | New preference system: sliders/ratings for activity types (museums, hiking, wineries, crossfit, shopping, etc.). Stored in Trip. Fed into Scout prompts. New wizard step or settings modal. |

---

## V5 Sprint — Activity Discovery + Bug Fixes — COMPLETE ✅

| ID | Task | Status | Commits |
|----|------|--------|---------|
| V5-1 | Activity Discovery Modal — Yelp/Google Maps style | ✅ done | `c508f02`, `2a14266`, `fa18385`, `7fd9a4e`, `421282e`, `179e89c`, `3dd2413`, `6fbebe0` |
| V5-2 | Dismissible validation warnings in DayDetailPanel | ✅ done | `0f67e98`, `036ade8` |
| V5-3 | Fix Find Activities blank state | ✅ done | `a78cdc5` |

---

## V4 Sprint — UX Improvements — COMPLETE ✅

| ID | Task | Status | Commits |
|----|------|--------|---------|
| V4-1 | Map layer per-type toggles (6 types w/ emoji) | ✅ done | `f458d8d` |
| V4-2 | Day detail panel → wide overlay modal (two-column) | ✅ done | `cc718f5`, `cba5450` |
| V4-3 | Click-to-edit activity with pre-filled form | ✅ done | `298d730`, `9c07644`, `b48178c` |
| V4-4 | Places autocomplete location bias toward trip region | ✅ done | `f458d8d`, `bf3fc1d` |
| V4-5 | Optimize Order — shows what changed or "already great" | ✅ done | `defbe4e`, `32d29c4` |
| V4-6 | "🔍 Find Activities" button wired in day modal | ✅ done | part of `cc718f5` |
| V4-7 | Drive time tooltip tighter styling | ✅ done | `68acb16` |

---

## V3 Sprint — Scout Intelligence — COMPLETE ✅

| ID | Task | Status | Notes |
|----|------|--------|-------|
| V3-1 | Scout chat streaming API | ✅ done | `/api/scout/chat` |
| V3-2 | Scout proactive tips API | ✅ done | `/api/scout/tips` |
| V3-3 | ScoutPanel chat drawer | ✅ done | `components/ScoutPanel.tsx` |
| V3-4 | Scout tips in Sidebar | ✅ done | `components/Sidebar.tsx` |
| V3-5 | Optimize day order API | ✅ done | `/api/scout/optimize-day` |
| V3-6 | Optimize Order button + toast in DayDetailPanel | ✅ done | |
| V3-7 | Recommend activities API | ✅ done | `/api/scout/recommend-activities` |
| V3-8 | RecommendActivitiesPanel component | ✅ done | `components/RecommendActivitiesPanel.tsx` |
| V3-9 | Plan Day API | ✅ done | `/api/scout/plan-day` |

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
