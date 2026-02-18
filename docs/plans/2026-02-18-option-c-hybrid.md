# Option C: Hybrid Smart Import + Enhanced Day View — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate manual-entry friction by adding AI-powered itinerary import, rebuild the day view into a rich detail panel with per-day dog status badges, and connect weather + validation UI to the existing engines.

**Architecture:** Three phases shipped independently. Phase 1 fixes core UX gaps (day panel, dog badges). Phase 2 adds AI import via Anthropic API + Google Geocoding. Phase 3 wires existing weather/validation engines into the UI.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, Supabase (storage), Google Maps JS API + Geocoding API, Anthropic SDK (`@anthropic-ai/sdk`), Weather.gov API (already built).

---

## CONTEXT FOR SUBAGENTS

Read these files before starting any task:
- `types/index.ts` — all data models
- `lib/store.tsx` — TripContext (addActivity, updateActivity, removeActivity, selectedDay, setSelectedDay)
- `lib/validation.ts` — validateDay, validateTrip (already complete, just needs UI)
- `lib/weather.ts` — fetchWeatherForLocation, getWeatherEmoji, getWeatherWarning (already complete)
- `components/DayCard.tsx` — current day card (we expand on this)
- `components/Sidebar.tsx` — renders DayCards
- `components/Map.tsx` — handles map, markers, click-to-add
- `components/AddActivityForm.tsx` — current add form (map-click only)
- `status.json` — project dashboard (update after each task)

Verification commands:
- Type check: `npx tsc --noEmit`
- Build check: `npm run build`
- Dev server: `npm run dev` (localhost:3000 or 3004)

---

## PHASE 1: Core UX Gaps

---

### Task 1: Dog/No-Dog Day Status Badge

**Priority:** P0 | **Estimate:** 30 min | **Assignable to:** Subagent

**Files:**
- Modify: `components/DayCard.tsx`

**What it does:** Adds a visual badge to each DayCard showing dog status for the day based on activity types. Three states: 🐕 Dog Day (all activities dog-friendly), 🚫 No-Dog Day (any activity has isDogFriendly=false), ⬜ No Activities Yet.

**Step 1: Implement the badge logic in DayCard.tsx**

Add a `getDogStatus` helper and badge JSX inside the existing `DayCard` component. Insert after the day header `<div>` that shows "Day X" and the date.

```tsx
// Add inside DayCard component, before the return statement:
const getDogStatus = (activities: Activity[]) => {
  if (activities.length === 0) return null;
  const hasNoDogActivity = activities.some(a => a.isDogFriendly === false);
  if (hasNoDogActivity) return 'no-dog';
  return 'dog';
};

const dogStatus = getDogStatus(day.activities);
```

Badge JSX to add next to the activity count `<div>` in the header row:

```tsx
{dogStatus === 'dog' && (
  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
    🐕 Dog
  </span>
)}
{dogStatus === 'no-dog' && (
  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
    🚫 No Dog
  </span>
)}
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Visual verify**

Open dev server, create/load a trip. Add a trail with isDogFriendly=true → see 🐕 Dog badge. Add an activity with isDogFriendly=false → badge changes to 🚫 No Dog.

**Step 4: Commit**

```bash
git add components/DayCard.tsx
git commit -m "feat: add dog/no-dog status badge to DayCard"
```

**Step 5: Update status.json**

Mark Task 1 as completed, increment completedTasks.

---

### Task 2: Day Detail Panel

**Priority:** P0 | **Estimate:** 2 hrs | **Assignable to:** Subagent

**Files:**
- Create: `components/DayDetailPanel.tsx`
- Modify: `components/Sidebar.tsx`
- Modify: `components/Map.tsx` (add `focusDay` effect)

**What it does:** Clicking a DayCard opens a slide-out panel showing the day's full detail: date, dog badge, validation status badge, weather (if available), activities in a timeline list with remove controls, and an "Add Activity" CTA button. The map simultaneously fits bounds to that day's activities.

**Step 1: Create DayDetailPanel.tsx**

```tsx
'use client';

import { Day, Activity } from '@/types';
import { useTrip } from '@/lib/store';
import { getValidationEmoji, getValidationColor } from '@/lib/validation';

interface DayDetailPanelProps {
  day: Day;
  onClose: () => void;
  onAddActivity: () => void;
}

const activityIcons: Record<string, string> = {
  trail: '🥾',
  hotel: '🏨',
  restaurant: '🍽️',
  camping: '⛺',
  park: '🏞️',
};

function getDogStatus(activities: Activity[]) {
  if (activities.length === 0) return null;
  return activities.some(a => a.isDogFriendly === false) ? 'no-dog' : 'dog';
}

export default function DayDetailPanel({ day, onClose, onAddActivity }: DayDetailPanelProps) {
  const { removeActivity } = useTrip();
  const dogStatus = getDogStatus(day.activities);

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="font-bold text-gray-900">Day {day.dayNumber}</h3>
          {day.date && <p className="text-xs text-gray-500">{formatDate(day.date)}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
          ✕
        </button>
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        {dogStatus === 'dog' && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">🐕 Dog Day</span>
        )}
        {dogStatus === 'no-dog' && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">🚫 No Dog</span>
        )}
        {day.validationStatus.level !== 'success' && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getValidationColor(day.validationStatus.level)}`}>
            {getValidationEmoji(day.validationStatus.level)} {day.validationStatus.messages[0]?.message}
          </span>
        )}
        {day.weather && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
            {day.weather.high}°/{day.weather.low}° {day.weather.shortForecast}
          </span>
        )}
      </div>

      {/* Activities Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {day.activities.length === 0 && (
          <p className="text-sm text-gray-400 italic text-center py-8">No activities yet</p>
        )}
        <div className="space-y-2">
          {day.activities.map((activity, index) => (
            <div key={activity.id} className="flex items-start gap-3 group p-2 rounded-lg hover:bg-gray-50">
              <div className="flex flex-col items-center">
                <span className="text-xl">{activityIcons[activity.type]}</span>
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
          ))}
        </div>
      </div>

      {/* Add Activity CTA */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onAddActivity}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <span>+</span>
          <span>Add Activity to Day {day.dayNumber}</span>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Update Sidebar.tsx**

Add state for showing the detail panel. When a DayCard is clicked, show DayDetailPanel alongside (or replace) the list.

In `Sidebar.tsx`, add import and state:

```tsx
import DayDetailPanel from './DayDetailPanel';
import AddActivityForm from './AddActivityForm';

// Inside the component, add:
const [showDetailPanel, setShowDetailPanel] = useState(false);
const [showAddForm, setShowAddForm] = useState(false);
```

Replace the DayCard `onClick` flow: DayCard click → `setSelectedDay(day.dayNumber)` + `setShowDetailPanel(true)`.

Add the panel as a second column when `showDetailPanel && selectedDay`:

```tsx
{showDetailPanel && selectedDay && trip && (
  <DayDetailPanel
    day={trip.days.find(d => d.dayNumber === selectedDay)!}
    onClose={() => setShowDetailPanel(false)}
    onAddActivity={() => setShowAddForm(true)}
  />
)}

{showAddForm && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <AddActivityForm
      coordinates={{ lat: 39.8283, lng: -98.5795 }}
      onClose={() => setShowAddForm(false)}
    />
  </div>
)}
```

**Step 3: Type check + build**

```bash
npx tsc --noEmit
npm run build
```

**Step 4: Visual verify**

Click any DayCard → DayDetailPanel slides in showing activities, dog badge, and "Add Activity" button.

**Step 5: Commit**

```bash
git add components/DayDetailPanel.tsx components/Sidebar.tsx
git commit -m "feat: add DayDetailPanel with timeline, dog badge, and add activity CTA"
```

---

### Task 3: Geocoding Utility + Add Activity from Day Panel

**Priority:** P0 | **Estimate:** 1.5 hrs | **Assignable to:** Subagent

**Files:**
- Create: `lib/geocoding.ts`
- Modify: `components/AddActivityForm.tsx`

**What it does:** Users can now type a place name (e.g., "Angels Landing, Zion National Park") in the Add Activity form and get it geocoded automatically. Coordinates are no longer required to come from a map click.

**Step 1: Create lib/geocoding.ts**

```typescript
// Geocodes a place name using the Google Maps Geocoding API.
// Returns null on failure. Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.

export async function geocodePlace(
  placeName: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const encoded = encodeURIComponent(placeName);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}
```

**Step 2: Update AddActivityForm.tsx**

Add a "Search Place" text input. When user types a name and submits (or clicks a resolve button), call `geocodePlace`. If coordinates were passed in (map-click flow), use those as default. Add a `geocodedName` state and a loading state.

Key changes to `AddActivityForm.tsx`:
1. Make `coordinates` prop optional: `coordinates?: Coordinates`
2. Add `placeName` state (separate from `name` — this is the search query for geocoding)
3. Add a "Resolve Location" button that calls `geocodePlace(name)` and sets `parsedCoords`
4. Show a "Location resolved ✓" indicator when geocoding succeeds
5. Show "Location not found — try a more specific name" on failure

```tsx
const [isGeocoding, setIsGeocoding] = useState(false);
const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'success' | 'error'>('idle');

const handleGeocode = async () => {
  if (!name.trim()) return;
  setIsGeocoding(true);
  setGeocodeStatus('idle');
  const result = await geocodePlace(name.trim());
  if (result) {
    setParsedCoords(result);
    setGeocodeStatus('success');
  } else {
    setGeocodeStatus('error');
  }
  setIsGeocoding(false);
};
```

Add geocode button next to the Name field:

```tsx
<div className="flex gap-2">
  <input ... /> {/* existing name input */}
  <button
    type="button"
    onClick={handleGeocode}
    disabled={isGeocoding || !name.trim()}
    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 disabled:opacity-50"
  >
    {isGeocoding ? '...' : '📍'}
  </button>
</div>
{geocodeStatus === 'success' && <p className="text-xs text-green-600">Location resolved ✓</p>}
{geocodeStatus === 'error' && <p className="text-xs text-red-500">Location not found — try a more specific name</p>}
```

**Step 3: Type check**

```bash
npx tsc --noEmit
```

**Step 4: Visual verify**

Open DayDetailPanel → click "Add Activity to Day X" → type "Grand Canyon South Rim" → click 📍 → see "Location resolved ✓" → submit → activity appears on map at correct location.

**Step 5: Commit**

```bash
git add lib/geocoding.ts components/AddActivityForm.tsx
git commit -m "feat: add geocoding utility and place-name search to AddActivityForm"
```

---

## PHASE 2: Smart AI Import

---

### Task 4: Install Anthropic SDK

**Priority:** P1 | **Estimate:** 5 min | **Assignable to:** Subagent

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.local` (add ANTHROPIC_API_KEY)

**Step 1: Install**

```bash
npm install @anthropic-ai/sdk
```

**Step 2: Add env variable**

Add to `.env.local`:
```
ANTHROPIC_API_KEY=your_key_here
```

The user must provide their Anthropic API key. If they don't have one, they can get it at https://console.anthropic.com

**Step 3: Verify install**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @anthropic-ai/sdk for AI import feature"
```

---

### Task 5: AI Import API Route

**Priority:** P1 | **Estimate:** 1.5 hrs | **Assignable to:** Subagent

**Files:**
- Create: `app/api/import/route.ts`

**What it does:** Accepts raw text (pasted itinerary or spreadsheet data) and returns a structured trip JSON that maps directly to our `Trip` type. Uses `claude-haiku-4-5-20251001` for speed and cost efficiency.

**Step 1: Create app/api/import/route.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a travel itinerary parser. Given raw trip notes or a pasted spreadsheet, extract a structured trip plan.

Return ONLY valid JSON with this exact shape:
{
  "tripName": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "hasDog": boolean,
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "name": "string (place name, specific enough to geocode)",
          "type": "trail" | "hotel" | "restaurant" | "camping" | "park",
          "isDogFriendly": boolean,
          "notes": "string or null"
        }
      ]
    }
  ]
}

Rules:
- dayNumber starts at 1
- Infer type from context: hotels/motels/airbnb → "hotel", hikes/trails → "trail", campgrounds/dispersed → "camping", restaurants/cafes → "restaurant", national parks/state parks → "park"
- isDogFriendly: default true unless context suggests otherwise (e.g., "no pets", "Angels Landing" - known no-dog trail)
- Place names must be specific enough to geocode (include city/state/park name)
- If you can't determine a date, distribute days evenly from startDate
- hasDog: true if dog is mentioned anywhere`;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json({ error: 'Please provide itinerary text (minimum 10 characters)' }, { status: 400 });
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Parse this itinerary into the structured JSON format:\n\n${text}`,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response from AI' }, { status: 500 });
    }

    // Extract JSON from the response (handle markdown code blocks)
    const raw = content.text;
    const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('Import API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to parse itinerary' }, { status: 500 });
  }
}
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Test with curl**

```bash
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -d '{"text": "June 2-4 road trip. Day 1: Drive from Denver to Moab, stay at Moab Valley RV Resort. Day 2: Arches National Park hike. Day 3: Drive to Capitol Reef. Dog coming with us."}'
```

Expected: JSON with tripName, startDate, endDate, hasDog: true, 3 days with activities.

**Step 4: Commit**

```bash
git add app/api/import/route.ts
git commit -m "feat: add AI import API route using Claude Haiku"
```

---

### Task 6: Import Modal UI

**Priority:** P1 | **Estimate:** 2 hrs | **Assignable to:** Subagent

**Files:**
- Create: `components/ImportItinerary.tsx`

**What it does:** A modal with two tabs — "Paste Text" and "Paste Spreadsheet." User pastes content, clicks "Parse with AI," sees a preview of extracted days/activities, confirms, and the trip loads into the store.

**Step 1: Create components/ImportItinerary.tsx**

```tsx
'use client';

import { useState } from 'react';
import { useTrip } from '@/lib/store';
import { geocodePlace } from '@/lib/geocoding';
import { parseLocalDate } from '@/lib/dateUtils';
import { Trip, Activity } from '@/types';

interface ImportItineraryProps {
  onClose: () => void;
}

interface ParsedActivity {
  name: string;
  type: string;
  isDogFriendly: boolean;
  notes: string | null;
}

interface ParsedDay {
  dayNumber: number;
  date: string;
  activities: ParsedActivity[];
}

interface ParsedTrip {
  tripName: string;
  startDate: string;
  endDate: string;
  hasDog: boolean;
  days: ParsedDay[];
}

export default function ImportItinerary({ onClose }: ImportItineraryProps) {
  const { setTrip } = useTrip();
  const [activeTab, setActiveTab] = useState<'text' | 'spreadsheet'>('text');
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [parsed, setParsed] = useState<ParsedTrip | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    setError(null);
    setParsed(null);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');
      setParsed(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = async () => {
    if (!parsed) return;
    setIsApplying(true);

    try {
      const startDate = parseLocalDate(parsed.startDate);
      const endDate = parseLocalDate(parsed.endDate);

      // Geocode all activity names
      const geocodeFallback = { lat: 39.8283, lng: -98.5795 }; // USA center
      const days = await Promise.all(
        parsed.days.map(async (d) => {
          const activities: Activity[] = await Promise.all(
            d.activities.map(async (a) => {
              const coords = await geocodePlace(a.name) ?? geocodeFallback;
              return {
                id: crypto.randomUUID(),
                type: a.type as Activity['type'],
                name: a.name,
                coordinates: coords,
                dayNumber: d.dayNumber,
                isDogFriendly: a.isDogFriendly,
                notes: a.notes ?? undefined,
              };
            })
          );
          return {
            dayNumber: d.dayNumber,
            date: parseLocalDate(d.date),
            activities,
            validationStatus: { level: 'success' as const, messages: [] },
          };
        })
      );

      const newTrip: Trip = {
        id: crypto.randomUUID(),
        name: parsed.tripName,
        startDate,
        endDate,
        days,
        isLoopTrip: false,
        peopleCount: 2,
        hasDog: parsed.hasDog,
        tripPace: 'balanced',
        maxDrivingHours: 6,
        drivingPreference: 'flexible',
        planningStyle: 'existing',
        lodgingPreferences: [],
        isNewCamper: false,
        budgetStyle: 'midrange',
        splurgeNights: 0,
        mustHaves: [],
      };

      setTrip(newTrip);
      onClose();
    } catch (err: any) {
      setError('Failed to apply trip: ' + err.message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Import Itinerary</h2>
          <p className="text-sm text-gray-500">Paste your existing plan — AI will parse it</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      {!parsed ? (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-6">
            {(['text', 'spreadsheet'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'text' ? '📝 Free-form text' : '📊 Spreadsheet data'}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-sm text-gray-600 mb-3">
              {activeTab === 'text'
                ? 'Paste your trip notes, email, or any free-form description of your itinerary.'
                : 'Copy and paste rows from your Google Sheets or Excel spreadsheet (including headers).'}
            </p>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={
                activeTab === 'text'
                  ? 'e.g. "June 2: Drive from Denver to Moab, stay at hotel. June 3: Hike Delicate Arch..."'
                  : 'e.g. "Date\tLocation\tActivity\tLodging\nJune 2\tMoab UT\tDrive\tHotel..."'
              }
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm resize-none"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          <div className="px-6 pb-6">
            <button
              onClick={handleParse}
              disabled={isParsing || !inputText.trim()}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isParsing ? '🤖 Parsing with AI...' : '🤖 Parse with AI'}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Preview */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800">{parsed.tripName}</h3>
              <p className="text-sm text-green-700">
                {parsed.startDate} → {parsed.endDate} • {parsed.days.length} days
                {parsed.hasDog && ' • 🐕 Dog included'}
              </p>
            </div>

            <div className="space-y-3">
              {parsed.days.map(day => (
                <div key={day.dayNumber} className="border border-gray-200 rounded-lg p-3">
                  <p className="font-medium text-gray-900 text-sm mb-2">
                    Day {day.dayNumber} — {day.date}
                  </p>
                  {day.activities.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 ml-3">
                      <span>{a.type === 'trail' ? '🥾' : a.type === 'hotel' ? '🏨' : a.type === 'camping' ? '⛺' : a.type === 'restaurant' ? '🍽️' : '🏞️'}</span>
                      <span>{a.name}</span>
                      <span className="text-xs">{a.isDogFriendly ? '🐕' : '🚫'}</span>
                    </div>
                  ))}
                  {day.activities.length === 0 && (
                    <p className="text-xs text-gray-400 ml-3">No activities detected</p>
                  )}
                </div>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => setParsed(null)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              ← Re-parse
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {isApplying ? '📍 Geocoding & applying...' : '✓ Apply to Trip'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add components/ImportItinerary.tsx
git commit -m "feat: add ImportItinerary modal with AI parsing and geocoding"
```

---

### Task 7: Homepage Import CTA

**Priority:** P1 | **Estimate:** 30 min | **Assignable to:** Subagent

**Files:**
- Modify: `components/Homepage.tsx`
- Modify: `app/page.tsx`

**What it does:** Adds an "Import Existing Plan" button on the homepage hero section alongside "Start Planning." Clicking it opens the ImportItinerary modal.

**Step 1: Update app/page.tsx**

Add `showImport` state and pass `onImport` prop:

```tsx
const [showImport, setShowImport] = useState(false);

// In JSX, add import of ImportItinerary:
import ImportItinerary from "@/components/ImportItinerary";

// Pass to Homepage:
<Homepage onStartPlanning={() => setShowWizard(true)} onImport={() => setShowImport(true)} />

// Add modal:
{showImport && typeof window !== 'undefined' && createPortal(
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <ImportItinerary onClose={() => setShowImport(false)} />
  </div>,
  document.body
)}
```

**Step 2: Update Homepage.tsx**

Add `onImport` to props interface and add a second CTA button:

```tsx
interface HomepageProps {
  onStartPlanning: () => void;
  onImport: () => void;
}

// In the CTAs div, add alongside the Start Planning button:
<button
  onClick={onImport}
  className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 text-lg font-semibold rounded-lg transition-colors border-2 border-orange-200 hover:border-orange-300"
>
  <span>📋</span>
  <span>Import Existing Plan</span>
</button>
```

**Step 3: Type check + build**

```bash
npx tsc --noEmit && npm run build
```

**Step 4: Commit**

```bash
git add components/Homepage.tsx app/page.tsx
git commit -m "feat: add Import Existing Plan CTA to homepage"
```

---

## PHASE 3: Intelligence Layer

---

### Task 8: Weather Badges on DayCard + DayDetailPanel

**Priority:** P2 | **Estimate:** 1.5 hrs | **Assignable to:** Subagent

**Files:**
- Modify: `lib/store.tsx`
- Modify: `components/DayCard.tsx`
- The weather fetch logic is already in `lib/weather.ts` and `app/api/weather/route.ts`

**What it does:** When a trip loads, fetch weather for the first activity's coordinates on each day (or the day's geocenter). Store weather on each Day in trip state. DayCard shows a compact weather badge. DayDetailPanel shows full weather info.

**Step 1: Add weather fetch to store.tsx**

After trip loads or is set, trigger `fetchWeatherForLocation` for each day that has activities with coordinates:

```typescript
// In setTrip callback or a useEffect watching trip:
import { fetchWeatherForLocation } from './weather';

// After loading trip, fetch weather for each day
const enrichWithWeather = async (trip: Trip): Promise<Trip> => {
  const updatedDays = await Promise.all(
    trip.days.map(async (day) => {
      const firstActivity = day.activities[0];
      if (!firstActivity || !day.date) return day;
      const weather = await fetchWeatherForLocation(
        firstActivity.coordinates.lat,
        firstActivity.coordinates.lng,
        day.date
      );
      return { ...day, weather: weather ?? undefined };
    })
  );
  return { ...trip, days: updatedDays };
};
```

**Step 2: Weather badge in DayCard.tsx**

```tsx
import { getWeatherEmoji } from '@/lib/weather';

// In DayCard header, add:
{day.weather && (
  <span className="text-xs text-gray-500">
    {getWeatherEmoji(day.weather)} {day.weather.high}°
  </span>
)}
```

**Step 3: Type check + build**

```bash
npx tsc --noEmit && npm run build
```

**Step 4: Commit**

```bash
git add lib/store.tsx components/DayCard.tsx
git commit -m "feat: integrate weather badges into DayCard from existing weather engine"
```

---

### Task 9: Validation UI in DayCard + DayDetailPanel

**Priority:** P2 | **Estimate:** 1 hr | **Assignable to:** Subagent

**Files:**
- Modify: `lib/store.tsx`
- Modify: `components/DayCard.tsx`

**What it does:** Run `validateTrip` after every trip change and store results on each Day. DayCard shows a 🔴/🟡/🟢 indicator. DayDetailPanel already renders validation messages from Task 2.

**Step 1: Run validation in store.tsx**

Import and call `validateTrip` in the trip state updater:

```typescript
import { validateTrip } from './validation';

// Wrap every setTripState call to re-validate:
const applyAndValidate = (trip: Trip): Trip => {
  const validatedDays = validateTrip(trip);
  return { ...trip, days: validatedDays };
};
```

Apply `applyAndValidate` in: `setTrip`, `addActivity`, `removeActivity`, `updateActivity`, `reorderActivities`.

**Step 2: Validation dot in DayCard.tsx**

```tsx
import { getValidationEmoji } from '@/lib/validation';

// In DayCard header, add next to dog badge:
{day.validationStatus.level !== 'success' && (
  <span className="text-sm" title={day.validationStatus.messages[0]?.message}>
    {getValidationEmoji(day.validationStatus.level)}
  </span>
)}
```

**Step 3: Type check + build**

```bash
npx tsc --noEmit && npm run build
```

**Step 4: Commit**

```bash
git add lib/store.tsx components/DayCard.tsx
git commit -m "feat: wire validation engine to DayCard UI indicators"
```

---

### Task 10: Map-Day Sync (Fit Bounds on Day Select)

**Priority:** P2 | **Estimate:** 45 min | **Assignable to:** Subagent

**Files:**
- Modify: `components/Map.tsx`
- Modify: `lib/store.tsx` (or add a context method)

**What it does:** When `selectedDay` changes, the map animates to fit that day's activity markers. Provides a sense of "this is where I'll be on Day X."

**Step 1: Add focusDay effect in Map.tsx**

```tsx
// Add effect watching selectedDay:
const { trip, selectedDay } = useTrip();

useEffect(() => {
  if (!map || !trip || !selectedDay) return;
  const day = trip.days.find(d => d.dayNumber === selectedDay);
  if (!day || day.activities.length === 0) return;

  if (day.activities.length === 1) {
    map.panTo(day.activities[0].coordinates);
    map.setZoom(12);
  } else {
    const bounds = new google.maps.LatLngBounds();
    day.activities.forEach(a => bounds.extend(a.coordinates));
    map.fitBounds(bounds, { padding: 80 });
  }
}, [selectedDay, map, trip]);
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add components/Map.tsx
git commit -m "feat: map auto-fits to selected day's activities"
```

---

## Execution Order

```
Phase 1 (P0 - do first):
  Task 1 → Task 2 → Task 3

Phase 2 (P1 - after Phase 1):
  Task 4 → Task 5 → Task 6 → Task 7

Phase 3 (P2 - can run parallel with Phase 2):
  Task 8 → Task 9 → Task 10
```

Tasks within each phase should be done sequentially (each builds on the previous). Tasks 8-10 can be parallelized with Tasks 5-7 since they touch different files.
