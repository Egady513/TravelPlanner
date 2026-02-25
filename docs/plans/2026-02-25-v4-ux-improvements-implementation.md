# V4 UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Seven targeted UX improvements: per-type map layer filters, a wide overlay modal for the day detail panel, click-to-edit activities, location-biased places autocomplete, better optimize feedback, a wired Find Activities button, and a tighter drive-time tooltip.

**Architecture:** DayDetailPanel becomes a self-contained fixed overlay modal (z-40) instead of an inline sidebar column. Sidebar shrinks back to w-80 always. AddActivityForm gains an `existingActivity` prop for edit mode. PlacesAutocomplete gains a `locationBias` prop. Map layer state collapses from 3 booleans to a single `Set<ActivityType>`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, React (useState/useMemo/createPortal), Google Maps JS API (Places Autocomplete bounds).

**Verification after every task:** `npx tsc --noEmit` must pass. `npm run build` must pass before committing.

---

## Task 1: V4-1 — Map Layer Per-Type Toggles

**Files:**
- Modify: `components/Map.tsx`

**What:** Replace the 3-bucket filter system (Activities / Driving / Lodging) with 6 individual type toggles (one per ActivityType).

---

**Step 1: Replace the 3 boolean state vars with a single Set**

Find these three lines (~line 92–94 in Map.tsx):
```typescript
const [showActivities, setShowActivities] = useState(true);
const [showDriving, setShowDriving] = useState(true);
const [showLodging, setShowLodging] = useState(true);
```

Replace with:
```typescript
const [visibleTypes, setVisibleTypes] = useState<Set<ActivityType>>(
  () => new Set<ActivityType>(['trail', 'hotel', 'restaurant', 'camping', 'park', 'driving'])
);
```

---

**Step 2: Update the marker filter logic**

Find the `allActivities` filter inside the markers `useEffect` (~line 201–209). It currently reads:
```typescript
const allActivities = trip.days.flatMap(day => day.activities).filter(a => {
  if (a.showOnMap === false) return false;
  if (!isDaySelected(a.dayNumber)) return false;
  if (a.type === 'driving') return showDriving;
  if (a.type === 'hotel') return showLodging;
  return showActivities;
});
```

Replace with:
```typescript
const allActivities = trip.days.flatMap(day => day.activities).filter(a => {
  if (a.showOnMap === false) return false;
  if (!isDaySelected(a.dayNumber)) return false;
  return visibleTypes.has(a.type);
});
```

---

**Step 3: Update the markers useEffect dependency array**

Find the dependency array at the end of the markers useEffect (~line 248):
```typescript
}, [map, trip, showActivities, showDriving, showLodging, selectedDays]);
```

Replace with:
```typescript
}, [map, trip, visibleTypes, selectedDays]);
```

---

**Step 4: Update the driving polylines useEffect**

Find the driving polylines useEffect. It has `if (!showDriving) return;` (~line 337). Replace:
```typescript
if (!showDriving) return;
```
With:
```typescript
if (!visibleTypes.has('driving')) return;
```

Also update its filter (the `allActivities` inside that effect, ~line 339–341):
```typescript
const allActivities = trip.days
  .flatMap(d => d.activities)
  .filter(a => a.showOnMap !== false && a.type === 'driving' && isDaySelected(a.dayNumber));
```
That line is already fine (no reference to old state vars). Check and confirm — no edit needed there.

Update the dependency array of the driving polylines useEffect (~line 430):
```typescript
}, [map, trip, showDriving, selectedDays, showDriveTimeTooltip]);
```
Replace with:
```typescript
}, [map, trip, visibleTypes, selectedDays, showDriveTimeTooltip]);
```

---

**Step 5: Replace the filter panel UI**

Find the filter panel section in the JSX (~line 482–509) — the three `<label>` elements for Activities, Driving, Lodging. Replace all three with:
```tsx
{(
  [
    { type: 'trail', label: 'Trail', emoji: '🥾' },
    { type: 'hotel', label: 'Hotel', emoji: '🏨' },
    { type: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { type: 'camping', label: 'Camping', emoji: '⛺' },
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
          e.target.checked ? next.add(type) : next.delete(type);
          return next;
        });
      }}
    />
    <span>{emoji} {label}</span>
  </label>
))}
```

---

**Step 6: TypeScript check + build + commit**

```bash
npx tsc --noEmit
npm run build
git add components/Map.tsx
git commit -m "feat(v4): per-type map layer filter toggles (V4-1)"
```

---

## Task 2: V4-4 — Places Autocomplete Location Bias

**Files:**
- Modify: `components/PlacesAutocomplete.tsx`
- Modify: `components/AddActivityForm.tsx`

**What:** Steer Google Places suggestions toward the trip's activity region (centroid of existing activities, or trip start location).

---

**Step 1: Add locationBias prop to PlacesAutocomplete**

Open `components/PlacesAutocomplete.tsx`. Find the interface:
```typescript
interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (result: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}
```

Add `locationBias`:
```typescript
interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (result: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  locationBias?: { lat: number; lng: number };
}
```

Update the function signature to destructure it:
```typescript
export default function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Search for a place...',
  className = '',
  locationBias,
}: PlacesAutocompleteProps) {
```

---

**Step 2: Apply the bias when initializing the Autocomplete**

Find the `useEffect` that creates the Autocomplete (~line 28):
```typescript
autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
  fields: ['name', 'geometry', 'formatted_address'],
});
```

Replace with:
```typescript
autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
  fields: ['name', 'geometry', 'formatted_address'],
});

if (locationBias) {
  const delta = 2; // ~2 degree radius (~140mi) soft bias
  autocompleteRef.current.setBounds(
    new window.google.maps.LatLngBounds(
      { lat: locationBias.lat - delta, lng: locationBias.lng - delta },
      { lat: locationBias.lat + delta, lng: locationBias.lng + delta }
    )
  );
}
```

Note: `strictBounds` is NOT set — this keeps it as a soft hint, not a hard restriction.

---

**Step 3: Compute locationBias in AddActivityForm**

Open `components/AddActivityForm.tsx`. Add `useMemo` to the import:
```typescript
import { useState, useEffect, useMemo } from 'react';
```

After the `const currentDayNumber = selectedDay || 1;` line, add:
```typescript
// Compute location bias toward the trip's activity region
const locationBias = useMemo(() => {
  if (!trip) return undefined;
  const coords = trip.days.flatMap(d => d.activities).map(a => a.coordinates);
  if (coords.length > 0) {
    return {
      lat: coords.reduce((sum, c) => sum + c.lat, 0) / coords.length,
      lng: coords.reduce((sum, c) => sum + c.lng, 0) / coords.length,
    };
  }
  return trip.startingLocation?.coordinates ?? undefined;
}, [trip]);
```

---

**Step 4: Pass locationBias to all three PlacesAutocomplete instances**

There are three `<PlacesAutocomplete>` usages in AddActivityForm:
1. The name field (~line 272)
2. The drive start location (~line 310)
3. The drive end location (~line 324)

Add `locationBias={locationBias}` to all three. Example for the name field:
```tsx
<PlacesAutocomplete
  value={name}
  onChange={(val) => {
    setName(val);
    setGeocodeStatus('idle');
  }}
  onPlaceSelected={handlePlaceSelected}
  placeholder="e.g., Angels Landing Trail"
  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  locationBias={locationBias}
/>
```

Do the same for the other two PlacesAutocomplete instances.

---

**Step 5: TypeScript check + build + commit**

```bash
npx tsc --noEmit
npm run build
git add components/PlacesAutocomplete.tsx components/AddActivityForm.tsx
git commit -m "feat(v4): location bias for Places autocomplete toward trip region (V4-4)"
```

---

## Task 3: V4-2 — Day Detail Panel as Wide Overlay Modal

**Files:**
- Modify: `components/DayDetailPanel.tsx`
- Modify: `components/Sidebar.tsx`

**What:** Replace the inline sidebar column with a fixed overlay modal (`max-w-3xl`, two-column layout). Sidebar returns to always `w-80`.

---

**Step 1: Rewrite DayDetailPanel to return a fixed overlay modal**

`DayDetailPanel` currently returns a `<div className="flex flex-col h-full bg-white border-l ... w-80 ...">`. Replace the entire return value with the modal layout below. Keep all existing state and handlers intact — only the JSX structure changes.

The new return:
```tsx
return (
  <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
    <div
      className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex-shrink-0">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Day {day.dayNumber}</h3>
          {day.date && <p className="text-sm text-gray-500">{formatDate(day.date)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddActivity}
            className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            + Add Activity
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-lg" aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Body: two columns */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: Activity list */}
        <div className="flex-1 overflow-y-auto p-4">
          {day.activities.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-12">No activities yet — click &quot;+ Add Activity&quot; to get started.</p>
          )}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId={`day-${day.dayNumber}`}>
              {(provided) => (
                <div
                  className="space-y-2"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {day.activities.map((activity, index) => (
                    <Draggable key={activity.id} draggableId={activity.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                        >
                          {activity.isContinuingStay ? (
                            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50 opacity-60 group">
                              <span className="text-xl flex-shrink-0 ml-4">{activityIcons[activity.type] ?? '📍'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-500 italic">
                                  {activityIcons[activity.type]} Continuing stay
                                  {activity.parentDayNumber ? ` (from Day ${activity.parentDayNumber})` : ''}
                                </p>
                                <p className="text-xs text-gray-400 truncate">{activity.name}</p>
                              </div>
                              <button
                                onClick={() => removeActivity(activity.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs p-1"
                                aria-label="Remove continuing stay"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div
                              className={`flex items-start gap-3 group p-2 rounded-lg cursor-pointer ${
                                dragSnapshot.isDragging ? 'bg-orange-50 shadow-md' : 'hover:bg-gray-50'
                              }`}
                              onClick={() => setEditingActivity(activity)}
                            >
                              {/* Drag handle + icon */}
                              <div
                                {...dragProvided.dragHandleProps}
                                className="flex flex-col items-center flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing"
                                onClick={e => e.stopPropagation()}
                              >
                                <span className="text-gray-300 text-xs leading-none select-none">⠿</span>
                                <span className="text-xl mt-0.5">{activityIcons[activity.type] ?? '📍'}</span>
                                {index < day.activities.length - 1 && (
                                  <div className="w-0.5 h-4 bg-gray-200 mt-1" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-gray-900 text-sm truncate">{activity.name}</p>
                                  {activity.requiresTickets === true && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateActivity(activity.id, { ticketsPurchased: !activity.ticketsPurchased });
                                      }}
                                      title={activity.ticketsPurchased ? 'Tickets purchased — click to toggle' : 'Tickets needed — click to mark purchased'}
                                      className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium cursor-pointer ${
                                        activity.ticketsPurchased
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {activity.ticketsPurchased ? '🎟️ ✓' : '🎟️ Tickets needed'}
                                    </button>
                                  )}
                                </div>
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
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateActivity(activity.id, { showOnMap: activity.showOnMap === false ? true : false });
                                  }}
                                  className="text-gray-400 hover:text-gray-600 text-xs p-1"
                                  title={activity.showOnMap === false ? 'Show on map' : 'Hide from map'}
                                  aria-label={activity.showOnMap === false ? 'Show on map' : 'Hide from map'}
                                >
                                  {activity.showOnMap === false ? '👁️‍🗨️' : '👁️'}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeActivity(activity.id); }}
                                  className="text-red-400 hover:text-red-600 text-xs p-1"
                                  aria-label="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Right: Status + Actions */}
        <div className="w-64 border-l border-gray-100 bg-gray-50 overflow-y-auto p-4 flex-shrink-0 space-y-3">
          {/* Dog status */}
          {dogStatus === 'dog' && (
            <span className="inline-flex text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">🐕 Dog Day</span>
          )}
          {dogStatus === 'no-dog' && (
            <span className="inline-flex text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">🚫 No Dog</span>
          )}

          {/* Weather */}
          {day.weather && (
            <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full inline-flex">
              {day.weather.high}°/{day.weather.low}° {day.weather.shortForecast}
            </div>
          )}

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

          {/* Optimize */}
          {day.activities.filter(a => !a.isContinuingStay).length >= 2 && (
            <button
              onClick={handleOptimizeOrder}
              disabled={isOptimizing}
              className="w-full text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-2 rounded-lg border border-orange-200 transition-colors disabled:opacity-50 font-medium"
            >
              {isOptimizing ? '⏳ Optimizing…' : '✨ Optimize Order'}
            </button>
          )}

          {/* Optimize result toast */}
          {optimizeReason && (
            <div className="px-3 py-2 bg-orange-50 border-2 border-orange-300 rounded-lg text-xs text-orange-800 flex items-start gap-2">
              <span className="flex-1">{optimizeReason}</span>
              <button onClick={() => setOptimizeReason(null)} className="flex-shrink-0 text-orange-400 hover:text-orange-600 leading-none">✕</button>
            </div>
          )}

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
        </div>
      </div>
    </div>

    {/* Edit Activity overlay */}
    {editingActivity && typeof window !== 'undefined' &&
      createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <AddActivityForm
            existingActivity={editingActivity}
            onClose={() => setEditingActivity(null)}
          />
        </div>,
        document.body
      )
    }
  </div>
);
```

---

**Step 2: Add the new state variables to DayDetailPanel**

At the top of the `DayDetailPanel` component function, after the existing state declarations, add:
```typescript
const [showRecommend, setShowRecommend] = useState(false);
const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
```

Also add these imports at the top of the file (after existing imports):
```typescript
import { createPortal } from 'react-dom';
import AddActivityForm from './AddActivityForm';
```

---

**Step 3: Update Sidebar.tsx — remove the width expansion and inline panel**

In `Sidebar.tsx`, find the outer div classname (~line 58–61):
```typescript
className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
  isCollapsed ? 'w-12' : showDetailPanel ? 'w-[640px]' : 'w-80'
}`}
```

Change to (sidebar is always `w-80` when not collapsed):
```typescript
className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
  isCollapsed ? 'w-12' : 'w-80'
}`}
```

Find the `{/* Days List + Detail Panel */}` section — it wraps a `<div className="flex flex-1 overflow-hidden">` containing a "Day List Column" div and a "Detail Panel Column". Simplify this: remove the outer flex wrapper and the "Detail Panel Column" section. The `{!isCollapsed && (...)}` block should just render the day list content directly without the flex wrapper.

Before the change it looks like:
```tsx
{!isCollapsed && (
  <div className="flex flex-1 overflow-hidden">
    {/* Day List Column */}
    <div className="w-80 flex flex-col flex-shrink-0">
      {/* ...all the day list content... */}
    </div>

    {/* Detail Panel Column */}
    {showDetailPanel && selectedDay && (
      <DayDetailPanel
        day={trip.days.find(d => d.dayNumber === selectedDay)!}
        onClose={() => setShowDetailPanel(false)}
        onAddActivity={() => setShowAddForm(true)}
      />
    )}
  </div>
)}
```

After the change:
```tsx
{!isCollapsed && (
  <div className="flex flex-1 overflow-hidden flex-col">
    {/* ...all the day list content (Scout tips, day cards, Add Day button, Clear Trip button)... */}
  </div>
)}
```

Then, **after** the closing `</div>` of the main sidebar div but **inside** the `<>` fragment, add the DayDetailPanel as a portal/overlay (alongside the existing AddActivityForm portal):

```tsx
{/* Day Detail Modal */}
{showDetailPanel && selectedDay && (
  <DayDetailPanel
    day={trip.days.find(d => d.dayNumber === selectedDay)!}
    onClose={() => setShowDetailPanel(false)}
    onAddActivity={() => setShowAddForm(true)}
  />
)}
```

---

**Step 4: TypeScript check + build + visual test**

```bash
npx tsc --noEmit
npm run build
```

Open dev server, select a day — confirm the wide modal opens over the map. Confirm clicking outside the modal closes it. Confirm both columns render. Confirm drag-and-drop still works.

```bash
git add components/DayDetailPanel.tsx components/Sidebar.tsx
git commit -m "feat(v4): day detail panel as wide overlay modal with two-column layout (V4-2)"
```

---

## Task 4: V4-3 — Activity Edit via Pre-filled Form

**Files:**
- Modify: `components/AddActivityForm.tsx`

**What:** Add `existingActivity?: Activity` prop. When present, pre-fill all state, show "Save Changes" button, and call `updateActivity` on submit.

---

**Step 1: Add existingActivity to AddActivityForm props and imports**

Find the interface at the top of AddActivityForm:
```typescript
interface AddActivityFormProps {
  coordinates?: Coordinates;
  onClose: () => void;
}
```

Add the prop (also add the missing type imports):
```typescript
interface AddActivityFormProps {
  coordinates?: Coordinates;
  onClose: () => void;
  existingActivity?: Activity;
}
```

Update the function signature:
```typescript
export default function AddActivityForm({ coordinates, onClose, existingActivity }: AddActivityFormProps) {
```

Add `updateActivity` to the store hook destructure (it's already in the store but not imported in this component):
```typescript
const { addActivity, selectedDay, trip, updateActivity } = useTrip();
```

---

**Step 2: Pre-fill state from existingActivity**

All the `useState` initializers need to check `existingActivity`. Replace each one:

```typescript
const [name, setName] = useState(existingActivity?.type !== 'driving' ? (existingActivity?.name ?? '') : '');
const [type, setType] = useState<ActivityType>(existingActivity?.type ?? 'trail');
const [isDogFriendly, setIsDogFriendly] = useState(existingActivity?.isDogFriendly ?? true);
const [notes, setNotes] = useState(existingActivity?.notes ?? '');
const [coordinateInput, setCoordinateInput] = useState('');
const [parsedCoords, setParsedCoords] = useState<Coordinates | null>(
  existingActivity?.coordinates ?? coordinates ?? null
);
const [isGeocoding, setIsGeocoding] = useState(false);
const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'success' | 'error'>('idle');

// Driving-specific
const existingDrive = existingActivity as import('@/types').DrivingActivity | undefined;
const [driveStartInput, setDriveStartInput] = useState(existingDrive?.startLocation?.name ?? '');
const [driveEndInput, setDriveEndInput] = useState(existingDrive?.endLocation?.name ?? '');
const [driveStart, setDriveStart] = useState<{ name: string; coordinates: Coordinates } | null>(
  existingDrive?.startLocation ?? null
);
const [driveEnd, setDriveEnd] = useState<{ name: string; coordinates: Coordinates } | null>(
  existingDrive?.endLocation ?? null
);
const [estimatedDriveHours, setEstimatedDriveHours] = useState<number | null>(
  existingDrive?.estimatedDriveHours ?? null
);

// Camping-specific
const existingCamping = existingActivity as import('@/types').CampingSpot | undefined;
const [sourceLink, setSourceLink] = useState(existingCamping?.sourceLink ?? '');
const [amenities, setAmenities] = useState(
  existingCamping?.amenities ?? { free: false, fireRing: false, cellCoverage: false, water: false }
);

// Hotel/camping pricing
const existingLodging = existingActivity as (import('@/types').Hotel | import('@/types').CampingSpot) | undefined;
const [pricePerNight, setPricePerNight] = useState<number | undefined>(existingLodging?.pricePerNight);
const [nights, setNights] = useState<number>(existingLodging?.nights ?? 1);

// Ticket tracking
const [requiresTickets, setRequiresTickets] = useState(existingActivity?.requiresTickets ?? false);
const [ticketsPurchased, setTicketsPurchased] = useState(existingActivity?.ticketsPurchased ?? false);
```

---

**Step 3: Update handleSubmit to call updateActivity when editing**

In `handleSubmit`, after building the `activity` object (just before the `addActivity(activity)` call at the end), add a branch:

Find the final section of `handleSubmit` (near the bottom, after all the type-specific branches):
```typescript
  addActivity(activity);
  onClose();
```

Replace with:
```typescript
  if (existingActivity) {
    updateActivity(existingActivity.id, activity as Partial<Activity>);
  } else {
    addActivity(activity);
  }
  onClose();
```

Also handle the driving path — find where the driving activity is submitted (~line 182–184):
```typescript
      addActivity(activity);
      onClose();
      return;
```
Replace with:
```typescript
      if (existingActivity) {
        updateActivity(existingActivity.id, activity as Partial<Activity>);
      } else {
        addActivity(activity);
      }
      onClose();
      return;
```

---

**Step 4: Update the submit button label**

Find the submit button in the JSX:
```tsx
<button
  type="submit"
  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
>
  Add Activity
</button>
```

Replace with:
```tsx
<button
  type="submit"
  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
>
  {existingActivity ? 'Save Changes' : 'Add Activity'}
</button>
```

Also update the modal title:
```tsx
<h3 className="text-lg font-semibold text-gray-900">Add Activity</h3>
```
→
```tsx
<h3 className="text-lg font-semibold text-gray-900">{existingActivity ? 'Edit Activity' : 'Add Activity'}</h3>
```

---

**Step 5: TypeScript check + build + visual test**

```bash
npx tsc --noEmit
npm run build
```

Open dev server, open a day modal, click an activity row — confirm the edit form opens pre-filled. Change a field, save — confirm the activity updates in the list.

```bash
git add components/AddActivityForm.tsx
git commit -m "feat(v4): click-to-edit activity with pre-filled form (V4-3)"
```

---

## Task 5: V4-5 — Optimize Order Feedback

**Files:**
- Modify: `components/DayDetailPanel.tsx`

**What:** Show a "no change needed" message when order is unchanged, show the reordered sequence when changed, bump dismiss timer to 10s, use a stronger border.

---

**Step 1: Update handleOptimizeOrder with before/after comparison**

Find the `handleOptimizeOrder` function. Replace the success block:

Current:
```typescript
const reordered = data.order
  .map(id => day.activities.find(a => a.id === id))
  .filter(Boolean) as typeof day.activities;
reorderActivities(day.dayNumber, reordered);
setOptimizeReason(data.reasoning);
setTimeout(() => setOptimizeReason(null), 6000);
```

Replace with:
```typescript
const reordered = data.order
  .map(id => day.activities.find(a => a.id === id))
  .filter(Boolean) as typeof day.activities;

// Check if order actually changed
const currentIds = day.activities.filter(a => !a.isContinuingStay).map(a => a.id);
const isSameOrder =
  data.order.length === currentIds.length &&
  data.order.every((id, i) => id === currentIds[i]);

if (isSameOrder) {
  setOptimizeReason('✨ Already in great shape — no changes needed!');
} else {
  reorderActivities(day.dayNumber, reordered);
  const nonStay = reordered.filter(a => !a.isContinuingStay);
  const names = nonStay.slice(0, 3).map((a, i) => `${i + 1}. ${a.name}`);
  const suffix = nonStay.length > 3 ? ' → …' : '';
  setOptimizeReason(`✨ Reordered: ${names.join(' → ')}${suffix}`);
}
setTimeout(() => setOptimizeReason(null), 10000);
```

---

**Step 2: TypeScript check + build + commit**

```bash
npx tsc --noEmit
npm run build
git add components/DayDetailPanel.tsx
git commit -m "feat(v4): optimize order shows sequence or no-change message (V4-5)"
```

---

## Task 6: V4-6 — Wire Find Activities Button

**What:** This is already wired in the new DayDetailPanel JSX from Task 3 (V4-2). The `showRecommend` state and the "🔍 Find Activities" button are included in the right column of the modal. If Task 3 was implemented correctly, no additional code is needed here.

**Verify:** Open a day modal. Confirm the "🔍 Find Activities" button appears in the right column. Click it — confirm `RecommendActivitiesPanel` expands below. Select a type — confirm suggestions load. Click "✕" or "▲ Hide Suggestions" — confirm it collapses.

```bash
git add components/DayDetailPanel.tsx
git commit -m "feat(v4): wire Find Activities button in day detail modal (V4-6)"
```

If no changes were needed (it was already included in V4-2's commit), skip this commit.

---

## Task 7: V4-7 — Drive Time Tooltip Tighter Styling (Low Priority)

**Files:**
- Modify: `components/Map.tsx`

**What:** Reduce whitespace in the Google Maps InfoWindow drive-time tooltip.

---

**Step 1: Update the InfoWindow content string**

Find the `showDriveTimeTooltip` callback (~line 124–134):
```typescript
driveTimeInfoWindow.current.setContent(`<div style="font-size:13px;padding:2px 4px">${label}</div>`);
```

Replace with:
```typescript
driveTimeInfoWindow.current.setContent(
  `<div style="font-size:12px;padding:3px 7px;line-height:1.4;white-space:nowrap;font-family:inherit">${label}</div>`
);
```

---

**Step 2: TypeScript check + build + commit**

```bash
npx tsc --noEmit
npm run build
git add components/Map.tsx
git commit -m "fix(v4): tighter drive time tooltip style (V4-7)"
```

---

## Summary

| # | Task | Files | Depends On |
|---|------|-------|------------|
| V4-1 | Map per-type layer filters | `Map.tsx` | — |
| V4-4 | Places autocomplete location bias | `PlacesAutocomplete.tsx`, `AddActivityForm.tsx` | — |
| V4-2 | Day detail overlay modal | `DayDetailPanel.tsx`, `Sidebar.tsx` | — |
| V4-3 | Activity edit (pre-filled form) | `AddActivityForm.tsx` | V4-2 (modal must exist) |
| V4-5 | Optimize order feedback | `DayDetailPanel.tsx` | V4-2 (in same file) |
| V4-6 | Wire Find Activities | `DayDetailPanel.tsx` | V4-2 (already in modal JSX) |
| V4-7 | Drive time tooltip | `Map.tsx` | — |

**Safe parallel order:** V4-1, V4-4, and V4-7 can be done in any order. V4-2 must land before V4-3, V4-5, V4-6.
