# V5 Activity Discovery + Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a large Activity Discovery Modal (Yelp-style, Scout + Google Places) and fix two small UX bugs.

**Architecture:** V5-3 and V5-2 are quick patches to existing components. V5-1 is a new `ActivityDiscoveryModal.tsx` backed by a new `/api/places/enrich` route; it replaces the inline `RecommendActivitiesPanel` with a full-screen overlay.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Google Places Text Search API (REST), Anthropic SDK (existing `/api/scout/recommend-activities` route reused)

---

### Task 1: V5-3 — Fix blank state in RecommendActivitiesPanel

**Files:**
- Modify: `components/RecommendActivitiesPanel.tsx`

**Context:** When Scout returns an empty `suggestions` array (no results), the panel shows nothing after loading. There is no empty-state message and no way to go back and pick a different type.

**Step 1: Open the file and find the results block**

Read `components/RecommendActivitiesPanel.tsx`. The relevant section starts around line 119 where `suggestions.length > 0` is checked.

**Step 2: Add an empty-state block between the error block and results block**

After the `{error && ...}` block (line 116) and before the `{suggestions.length > 0 && ...}` block (line 118), insert:

```tsx
      {/* Empty state — Scout found nothing */}
      {!isLoading && !error && selectedType !== null && suggestions.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 mb-3">No suggestions found for this type near this area.</p>
          <button
            onClick={() => { setSelectedType(null); setSuggestions([]); }}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
          >
            ← Change type
          </button>
        </div>
      )}
```

**Step 3: Verify TypeScript passes**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add components/RecommendActivitiesPanel.tsx
git commit -m "fix(v5): show empty state + change-type button when Scout finds nothing (V5-3)"
```

---

### Task 2: V5-2 — Dismissible validation warnings in DayDetailPanel

**Files:**
- Modify: `components/DayDetailPanel.tsx`

**Context:** Validation warnings in the right column have no X button — once shown, they can't be dismissed. We want session-only dismiss (local state, no persistence).

**Step 1: Add `dismissedWarnings` state**

In `DayDetailPanel`, after the existing `useState` declarations (around line 35–38), add:

```tsx
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
```

**Step 2: Add dismiss handler**

After the state declarations, add:

```tsx
  const dismissWarning = (message: string) => {
    setDismissedWarnings(prev => new Set(prev).add(message));
  };
```

**Step 3: Update the validation messages render block**

Find the validation messages block (around line 266):

```tsx
            {/* Validation messages */}
            {day.validationStatus.messages.filter(m => m.level !== 'success').map((msg, i) => (
              <div key={i}>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getValidationColor(msg.level)}`}>
                  {getValidationEmoji(msg.level)} {msg.message}
                </span>
                {msg.suggestion && (
                  <p className="text-xs text-gray-500 mt-0.5 pl-1">{msg.suggestion}</p>
                )}
              </div>
            ))}
```

Replace it with:

```tsx
            {/* Validation messages */}
            {day.validationStatus.messages
              .filter(m => m.level !== 'success' && !dismissedWarnings.has(m.message))
              .map((msg, i) => (
                <div key={i} className="relative">
                  <div className={`text-xs px-2 py-1 pr-6 rounded-full font-medium ${getValidationColor(msg.level)}`}>
                    {getValidationEmoji(msg.level)} {msg.message}
                    <button
                      onClick={() => dismissWarning(msg.message)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-current opacity-50 hover:opacity-100 leading-none"
                      aria-label="Dismiss warning"
                    >
                      ✕
                    </button>
                  </div>
                  {msg.suggestion && (
                    <p className="text-xs text-gray-500 mt-0.5 pl-1">{msg.suggestion}</p>
                  )}
                </div>
              ))}
```

**Step 4: Verify TypeScript passes**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 5: Commit**

```bash
git add components/DayDetailPanel.tsx
git commit -m "feat(v5): dismissible validation warnings with X button in DayDetailPanel (V5-2)"
```

---

### Task 3: V5-1a — Google Places enrichment API route

**Files:**
- Create: `app/api/places/enrich/route.ts`

**Context:** This server-side route accepts Scout suggestions and enriches them with Google Places data (photo URL, rating). It runs server-side to avoid CORS. Uses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` which is accessible server-side too.

**Step 1: Create the route file**

Create `app/api/places/enrich/route.ts`:

```typescript
import type { NextRequest } from 'next/server';

interface RawSuggestion {
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

interface EnrichedSuggestion extends RawSuggestion {
  photoUrl: string | null;
  rating: number | null;
  googlePlaceId: string | null;
}

interface PlacesTextSearchResult {
  place_id?: string;
  rating?: number;
  photos?: Array<{ photo_reference: string }>;
}

interface PlacesTextSearchResponse {
  results?: PlacesTextSearchResult[];
  status?: string;
}

async function enrichOne(s: RawSuggestion, apiKey: string): Promise<EnrichedSuggestion> {
  try {
    const query = encodeURIComponent(`${s.name} ${s.location}`);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );
    const data = await res.json() as PlacesTextSearchResponse;
    const place = data.results?.[0];
    if (!place) return { ...s, photoUrl: null, rating: null, googlePlaceId: null };

    const photoRef = place.photos?.[0]?.photo_reference ?? null;
    const photoUrl = photoRef
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${photoRef}&key=${apiKey}`
      : null;

    return {
      ...s,
      photoUrl,
      rating: place.rating ?? null,
      googlePlaceId: place.place_id ?? null,
    };
  } catch {
    return { ...s, photoUrl: null, rating: null, googlePlaceId: null };
  }
}

export async function POST(request: NextRequest) {
  let suggestions: RawSuggestion[];
  try {
    const body = await request.json() as { suggestions: RawSuggestion[] };
    suggestions = body.suggestions;
    if (!Array.isArray(suggestions)) throw new Error('suggestions must be an array');
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Gracefully degrade: return suggestions without enrichment
    const bare: EnrichedSuggestion[] = suggestions.map(s => ({
      ...s, photoUrl: null, rating: null, googlePlaceId: null,
    }));
    return Response.json({ enriched: bare });
  }

  const enriched = await Promise.all(suggestions.map(s => enrichOne(s, apiKey)));
  return Response.json({ enriched });
}
```

**Step 2: Verify TypeScript passes**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add app/api/places/enrich/route.ts
git commit -m "feat(v5): Google Places enrichment API route (V5-1a)"
```

---

### Task 4: V5-1b — ActivityDiscoveryModal component

**Files:**
- Create: `components/ActivityDiscoveryModal.tsx`

**Context:** A large modal (max-w-5xl, 80vh) that replaces the inline `RecommendActivitiesPanel`. Flow: type selection → Scout curates → Places enriches → cards grid. Renders via `createPortal` at z-50, above DayDetailPanel (z-40).

**Step 1: Create the component**

Create `components/ActivityDiscoveryModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Day, ActivityType, Activity, CampingSpot } from '@/types';
import { useTrip } from '@/lib/store';
import { geocodePlace } from '@/lib/geocoding';

interface RawSuggestion {
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

interface EnrichedSuggestion extends RawSuggestion {
  photoUrl: string | null;
  rating: number | null;
  googlePlaceId: string | null;
}

interface Props {
  day: Day;
  onClose: () => void;
}

const typeOptions: { type: ActivityType; label: string; emoji: string; description: string }[] = [
  { type: 'trail', label: 'Trails', emoji: '🥾', description: 'Hikes & nature walks' },
  { type: 'restaurant', label: 'Restaurants', emoji: '🍽️', description: 'Food & dining' },
  { type: 'hotel', label: 'Hotels', emoji: '🏨', description: 'Lodging options' },
  { type: 'camping', label: 'Camping', emoji: '⛺', description: 'Campgrounds & sites' },
  { type: 'park', label: 'Parks', emoji: '🏞️', description: 'Parks & scenic spots' },
];

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-xs ${i < full ? 'text-yellow-400' : i === full && half ? 'text-yellow-300' : 'text-gray-300'}`}>★</span>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function ActivityDiscoveryModal({ day, onClose }: Props) {
  const { trip, addActivity } = useTrip();
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [geocodingIds, setGeocodingIds] = useState<Set<number>>(new Set());

  const handleTypeSelect = async (type: ActivityType) => {
    setSelectedType(type);
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setAddedIds(new Set());

    try {
      // Step 1: Scout curates suggestions
      const scoutRes = await fetch('/api/scout/recommend-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, day, trip }),
      });
      if (!scoutRes.ok) throw new Error('Scout failed');
      const scoutData = await scoutRes.json() as { suggestions: RawSuggestion[] };

      if (!scoutData.suggestions?.length) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      // Step 2: Enrich with Google Places
      const enrichRes = await fetch('/api/places/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestions: scoutData.suggestions }),
      });
      const enrichData = await enrichRes.json() as { enriched: EnrichedSuggestion[] };
      setSuggestions(enrichData.enriched ?? []);
    } catch {
      setError('Could not get suggestions. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (s: EnrichedSuggestion, index: number) => {
    if (!trip || addedIds.has(index) || geocodingIds.has(index)) return;

    setGeocodingIds(prev => new Set(prev).add(index));
    try {
      const coords = await geocodePlace(`${s.name}, ${s.location}`);
      if (!coords) return;

      const activity: Activity = {
        id: crypto.randomUUID(),
        type: selectedType!,
        name: s.name,
        coordinates: coords,
        dayNumber: day.dayNumber,
        isDogFriendly: s.isDogFriendly,
        notes: s.why,
        ...(selectedType === 'camping' ? {
          amenities: { free: false, fireRing: false, cellCoverage: false, water: false },
        } as Partial<CampingSpot> : {}),
      } as Activity;

      addActivity(activity);
      setAddedIds(prev => new Set(prev).add(index));
    } finally {
      setGeocodingIds(prev => { const next = new Set(prev); next.delete(index); return next; });
    }
  };

  const handleReset = () => {
    setSelectedType(null);
    setSuggestions([]);
    setError(null);
    setAddedIds(new Set());
  };

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-xl">Find Activities</h2>
            <p className="text-sm text-gray-500">Day {day.dayNumber} · Scout will curate suggestions for your trip</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 text-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Type selection */}
          {!selectedType && (
            <div>
              <p className="text-sm text-gray-600 mb-4">What kind of activity are you looking for?</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {typeOptions.map(({ type, label, emoji, description }) => (
                  <button
                    key={type}
                    onClick={() => handleTypeSelect(type)}
                    className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors group"
                  >
                    <span className="text-3xl">{emoji}</span>
                    <span className="font-semibold text-gray-800 text-sm">{label}</span>
                    <span className="text-xs text-gray-500 text-center leading-tight">{description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-5xl mb-4 animate-bounce">🐕</div>
              <p className="text-gray-600 font-medium">Scout is finding the best options…</p>
              <p className="text-sm text-gray-400 mt-1">Checking local spots and enriching with reviews</p>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="text-center py-12">
              <p className="text-red-500 mb-3">{error}</p>
              <button onClick={handleReset} className="text-sm text-blue-600 hover:text-blue-700">← Try a different type</button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && selectedType !== null && suggestions.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🤷</div>
              <p className="text-gray-600 font-medium mb-1">No suggestions found</p>
              <p className="text-sm text-gray-400 mb-4">Scout couldn&apos;t find {selectedType} options near this area.</p>
              <button onClick={handleReset} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto">
                ← Try a different type
              </button>
            </div>
          )}

          {/* Results */}
          {!isLoading && suggestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-800">
                    {typeOptions.find(t => t.type === selectedType)?.emoji} {typeOptions.find(t => t.type === selectedType)?.label} near Day {day.dayNumber}
                  </p>
                  <p className="text-xs text-gray-500">{suggestions.length} suggestions from Scout</p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  ← Change type
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestions.map((s, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    {/* Photo */}
                    <div className="h-40 bg-gray-100 flex-shrink-0 relative overflow-hidden">
                      {s.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.photoUrl}
                          alt={s.name}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-5xl opacity-30">
                            {typeOptions.find(t => t.type === selectedType)?.emoji}
                          </span>
                        </div>
                      )}
                      {s.isDogFriendly && (
                        <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">🐕 Dog OK</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 flex flex-col flex-1">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{s.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.location}</p>
                      {s.rating !== null && <StarRating rating={s.rating} />}
                      <p className="text-xs text-gray-600 mt-2 flex-1 leading-relaxed">{s.why}</p>
                      <button
                        onClick={() => handleAdd(s, i)}
                        disabled={addedIds.has(i) || geocodingIds.has(i)}
                        className={`mt-3 w-full text-sm py-2 px-3 rounded-lg font-medium transition-colors ${
                          addedIds.has(i)
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : geocodingIds.has(i)
                            ? 'bg-gray-100 text-gray-500 cursor-wait'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        {addedIds.has(i) ? '✓ Added to Day' : geocodingIds.has(i) ? 'Adding…' : '+ Add to Day'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(modal, document.body);
}
```

**Step 2: Verify TypeScript passes**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add components/ActivityDiscoveryModal.tsx
git commit -m "feat(v5): ActivityDiscoveryModal with Scout + Google Places enrichment (V5-1b)"
```

---

### Task 5: V5-1c — Wire ActivityDiscoveryModal into DayDetailPanel, retire RecommendActivitiesPanel

**Files:**
- Modify: `components/DayDetailPanel.tsx`

**Context:** Replace the inline `RecommendActivitiesPanel` usage with the new full-screen `ActivityDiscoveryModal`. The "🔍 Find Activities" button should now open the large modal instead of toggling an inline panel.

**Step 1: Update imports in DayDetailPanel**

In `components/DayDetailPanel.tsx`, find:

```tsx
import RecommendActivitiesPanel from './RecommendActivitiesPanel';
```

Replace with:

```tsx
import ActivityDiscoveryModal from './ActivityDiscoveryModal';
```

**Step 2: Replace `showRecommend` state with `showDiscovery`**

Find:

```tsx
  const [showRecommend, setShowRecommend] = useState(false);
```

Replace with:

```tsx
  const [showDiscovery, setShowDiscovery] = useState(false);
```

**Step 3: Update the Find Activities button and inline panel in the right column**

Find this block (around line 296–308):

```tsx
            {/* Find Activities */}
            <button
              onClick={() => setShowRecommend(r => !r)}
              className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 transition-colors font-medium"
            >
              {showRecommend ? '▲ Hide Suggestions' : '🔍 Find Activities'}
            </button>

            {showRecommend && (
              <div className="border-t border-gray-200 pt-2">
                <RecommendActivitiesPanel day={day} onClose={() => setShowRecommend(false)} />
              </div>
            )}
```

Replace with:

```tsx
            {/* Find Activities */}
            <button
              onClick={() => setShowDiscovery(true)}
              className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 transition-colors font-medium"
            >
              🔍 Find Activities
            </button>
```

**Step 4: Add ActivityDiscoveryModal portal at the end of the component (before closing `</div>`)**

Find the closing section of the return statement, just before the final `</div>` of the component (after the `{editingActivity && ...}` portal block):

```tsx
      {/* Edit Activity overlay */}
      {editingActivity && typeof window !== 'undefined' &&
        createPortal(...)
      }
    </div>
  );
}
```

Add the discovery modal portal between the edit portal and the final `</div>`:

```tsx
      {/* Activity Discovery Modal */}
      {showDiscovery && (
        <ActivityDiscoveryModal day={day} onClose={() => setShowDiscovery(false)} />
      )}
```

**Step 5: Verify TypeScript passes**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 6: Run production build**

```bash
npm run build
```
Expected: Build completes with no errors (warnings about img element are acceptable).

**Step 7: Commit**

```bash
git add components/DayDetailPanel.tsx
git commit -m "feat(v5): wire ActivityDiscoveryModal in DayDetailPanel, retire RecommendActivitiesPanel (V5-1c)"
```

---

## Verification Checklist

After all tasks complete, spot-check in dev server (`npm run dev`):

1. **V5-3:** Open a day modal → click Find Activities → pick a type → if no results appear, verify empty state shows with "← Try a different type" button
2. **V5-2:** Open a day with validation warnings → verify X button appears on each → click X → warning disappears
3. **V5-1:** Open a day modal → click "🔍 Find Activities" → large modal opens → pick a type → loading state shows → cards appear with photos and ratings → click "+ Add to Day" → activity added → modal can be closed

## Files Changed Summary

| File | Action |
|------|--------|
| `components/RecommendActivitiesPanel.tsx` | Added empty-state block (V5-3) |
| `components/DayDetailPanel.tsx` | Added dismissedWarnings state + X buttons (V5-2); swapped to ActivityDiscoveryModal (V5-1c) |
| `app/api/places/enrich/route.ts` | Created — Google Places enrichment route (V5-1a) |
| `components/ActivityDiscoveryModal.tsx` | Created — full discovery modal (V5-1b) |
