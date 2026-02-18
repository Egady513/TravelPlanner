# Road Trip Planner v2 — Feature Design

> **Status:** Approved by user 2026-02-18
> **Implements:** 7 feature areas identified post-v1 testing
> **Plan file (to be created):** `docs/plans/2026-02-18-v2-implementation.md`

---

## 1. Navigation Fix (Bug — Highest Priority)

**Problem:** `app/page.tsx` line 68 does a hard `if (trip) { return mapView }`. Once a trip exists, the homepage and Import modal are completely inaccessible. The map view has no navigation bar.

**Fix:**
- Add a slim top nav bar to the map view with: `← Home` link (sets `trip = null` / navigates home), trip name display, and an `Import` button (re-opens `ImportItinerary` modal)
- Nav bar lives in the `if (trip)` branch of `app/page.tsx`, sits above the `<header>` or replaces it
- "← Home" does NOT delete the trip from Supabase — it just clears the in-memory state so the user can start a new trip or go back to My Trips later

**Files:** `app/page.tsx`, optionally a new `components/TopNav.tsx`

---

## 2. DayDetailPanel Enhancements

### 2a. Drag-and-Drop Activity Reorder

**Library:** `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd, React 18 compatible)

**Behavior:**
- In `DayDetailPanel.tsx`, wrap the activity list in `<DragDropContext>` + `<Droppable>`
- Each activity row becomes a `<Draggable>` with a visible drag handle (⠿ icon on left)
- On `onDragEnd`: call `reorderActivities(dayNumber, sourceIndex, destinationIndex)` — this action already exists in `lib/store.tsx`
- Map auto-updates because it watches `trip` from store

### 2b. Show/Hide Activity on Map Toggle

**Behavior:**
- Each activity row in `DayDetailPanel` gets a 👁️ / 👁️‍🗨️ toggle button
- Toggle state stored on the `Activity` type: `showOnMap: boolean` (default `true`)
- `Map.tsx` filters activities by `showOnMap === true` before rendering markers/polylines
- Use case: "I know I need gas but don't have a specific station yet — hide from map"

**Data change:** Add `showOnMap?: boolean` to `Activity` in `types/index.ts` (default `true` when undefined)

**Files:** `types/index.ts`, `components/DayDetailPanel.tsx`, `components/Map.tsx`, `lib/store.tsx` (update `updateActivity`)

---

## 3. Map Layer Filters + Route Hover

### 3a. Layer Filter Controls

**Behavior:**
- Filter bar rendered inside `Map.tsx` as an overlay panel (top-right corner)
- **Layer toggles** (independently togglable, can combine):
  - `🏔️ Activities` — trail/park/restaurant/camping markers
  - `🚗 Driving` — dashed driving polylines + 🚗 markers
  - `🏨 Lodging` — hotel markers
- **Day selector** (multi-select chips below layer toggles):
  - Default: "All Days" chip selected
  - Can deselect "All Days" and pick individual day chips (Day 1, Day 2, …)
  - When day chips selected, only activities for those days are shown
- All filter state is local React state (`useState`) — not persisted

**Files:** `components/Map.tsx` (new `MapFilters` sub-component or inline)

### 3b. Route Hover — Drive Time

**API:** Google Distance Matrix API (`/maps/api/distancematrix/json`)

**Behavior:**
- For each driving `Activity` (type: `'driving'`), the dashed polyline on the map gets a `mouseover` listener
- On hover: fetch Distance Matrix for that start→end pair; show an info tooltip with `🚗 2h 15min · 143 mi`
- Cache results in a `useRef` map keyed by `${lat1},${lng1}→${lat2},${lng2}` to avoid duplicate API calls
- Fetched via a new server-side route `/api/distance` (proxies to Google, keeps API key server-side) OR directly client-side using the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (already public, simpler)

**Decision:** Use client-side fetch (key already public for Maps JS API usage). Call `https://maps.googleapis.com/maps/api/distancematrix/json` with `origins`, `destinations`, and the public key.

**Files:** `components/Map.tsx`

---

## 4. Wizard Preset Validation Badges

**Problem:** The user set trip preferences during the 6-step wizard (max driving hours, number of hotel nights, etc.) but violations of those preferences are not visible on DayCards.

**Current state:** `lib/validation.ts` has `validateTrip()` which is already wired into all store actions. But the current rules don't cross-reference wizard presets stored on the `Trip` object.

**New rules to add in `lib/validation.ts`:**
- `maxDrivingHours` exceeded on any day → `⚠️ warning` "Day {n}: driving exceeds your {X}hr limit"
- `lodgingPreferences` includes `'hotel'` but a day has no hotel activity → `ℹ️ info` hint (not an error)
- `hasDog: true` + activity `isDogFriendly === false` → `🔴 error` "Dog can't attend this activity — arrange care"
- `tripPace === 'relaxed'` but >3 activities in a day → `ℹ️ info` "Busy day for a relaxed pace"

**Badges:** The existing `🔴/🟡/🟢` validation dot on `DayCard` and full messages in `DayDetailPanel` already handle rendering — only the rule logic needs updating.

**Files:** `lib/validation.ts`

---

## 5. Scout AI Assistant

**Scout** is the trip-aware AI companion. Named "Scout" — the reliable guide dog of planning assistants.

### Architecture

**Context injection:** Trip JSON serialized directly into the Claude system prompt — no RAG, no vector DB. The full trip is small (<50KB) and fits easily in the 200k context window.

**Two surfaces:**
1. **Floating chat button** — bottom-right corner of the map view, always visible. Opens/closes a `ScoutPanel` drawer.
2. **Proactive tips** — dismissible callout cards in the `Sidebar`, above the day list. Generated automatically ~3 seconds after the trip changes.

### ScoutPanel (Chat)

- Drawer slides in from right (or appears as a fixed panel), `w-96`
- Message history: user messages + Scout responses, scrollable
- Input at bottom with send button
- "Powered by Claude" attribution
- API route: `POST /api/scout/chat`
  - Body: `{ messages: [{role, content}], tripContext: Trip }`
  - Model: `claude-sonnet-4-6` (reasoning quality matters here)
  - System prompt includes full serialized trip JSON
  - Streamed response via `ReadableStream`
- Chat history persisted to Supabase `scout_messages` table (trip_id FK)

### Proactive Tips

- Triggered by a `useEffect` in `Sidebar.tsx` watching `trip` (debounced 3s)
- API route: `POST /api/scout/tips`
  - Body: `{ trip: Trip }`
  - Model: `claude-haiku-4-5-20251001` (cost-efficient, tips are short)
  - Returns array of `{ id, message, type: 'warning'|'info'|'suggestion' }`
- Tip examples:
  - "I see you're planning to stay at Capitol Reef, but your first activity next day is 2hrs away — consider staying closer"
  - "You have 4hrs of non-pet-friendly activities on Day 3 — Scout needs somewhere to stay while you hike"
- Tips shown as callout cards in `Sidebar` above day list, each with an `×` dismiss button
- Dismissed tip IDs stored in `localStorage` (not Supabase — ephemeral is fine)

**New files:** `components/ScoutPanel.tsx`, `components/ScoutTip.tsx`, `app/api/scout/chat/route.ts`, `app/api/scout/tips/route.ts`

**Supabase table:** `scout_messages (id, trip_id, role, content, created_at)`

---

## 6. Dashboard Stats Panel (Lowest Priority)

**Surface:** Accessible via a `📊 Dashboard` button in the nav bar (top right of map view). Opens a full-screen modal overlay.

**Sections (all computed from `trip` state, no extra API calls):**
- **Trip Overview** — name, dates, duration, people count, pace
- **Driving Summary** — total driving activities, est. total miles (sum of any distance data cached from route hover), longest driving day
- **Lodging Breakdown** — nights by type (hotel/camping/unknown), any gaps (nights with no lodging)
- **Dog Status** — days dog-friendly vs not, list of non-dog activities by day
- **Validation Summary** — count of 🔴/🟡/🟢 per day, expandable list of all messages
- **Weather Snapshot** — grid of weather badges per day (reuses `getWeatherEmoji`)

Each section card is clickable → opens a focused detail modal with full info.

**Files:** `components/DashboardModal.tsx`, `app/page.tsx` (add Dashboard button to nav bar)

---

## Implementation Priority Order

1. **Navigation fix** — unblocks Import and homepage; 30-min task
2. **Scout AI** — highest strategic value ("the true differentiating factor")
3. **DayDetailPanel enhancements** — drag-and-drop + show/hide toggle
4. **Map layer filters + route hover** — map power-user features
5. **Wizard preset validation** — polish to existing validation engine
6. **Dashboard** — lowest priority, purely additive

---

## Non-Goals

- No RAG / vector embeddings for Scout
- No mobile-first redesign
- No offline mode
- No print/export
- No photo attachments
- No reservation tracker
