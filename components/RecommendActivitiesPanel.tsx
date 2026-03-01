'use client';

import { useState } from 'react';
import { useTrip } from '@/lib/store';
import { geocodePlace } from '@/lib/geocoding';
import type { Day, ActivityType, Activity, CampingSpot } from '@/types';

interface Suggestion {
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

interface Props {
  day: Day;
  onClose: () => void;
}

const typeOptions: { type: ActivityType; label: string; emoji: string }[] = [
  { type: 'trail', label: 'Trail', emoji: '🥾' },
  { type: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { type: 'hotel', label: 'Hotel', emoji: '🏨' },
  { type: 'camping', label: 'Camping', emoji: '⛺' },
  { type: 'park', label: 'Park', emoji: '🏞️' },
];

export default function RecommendActivitiesPanel({ day, onClose }: Props) {
  const { trip, addActivity } = useTrip();
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<(Suggestion & { geocoded?: { lat: number; lng: number } | null })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleTypeSelect = async (type: ActivityType) => {
    setSelectedType(type);
    setIsLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const res = await fetch('/api/scout/recommend-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, day, trip }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { suggestions: Suggestion[] };

      // Geocode all suggestions in parallel
      const withCoords = await Promise.all(
        data.suggestions.map(async (s) => {
          const coords = await geocodePlace(`${s.name}, ${s.location}`);
          return { ...s, geocoded: coords };
        })
      );
      setSuggestions(withCoords);
    } catch {
      setError('Could not get recommendations. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = (s: typeof suggestions[0], index: number) => {
    if (!s.geocoded || !trip) return;
    const activity: Activity = {
      id: crypto.randomUUID(),
      type: selectedType!,
      name: s.name,
      coordinates: s.geocoded,
      dayNumber: day.dayNumber,
      isDogFriendly: s.isDogFriendly,
      notes: s.why,
      ...(selectedType === 'camping' ? {
        amenities: { free: false, fireRing: false, cellCoverage: false, water: false },
      } as Partial<CampingSpot> : {}),
    } as Activity;
    addActivity(activity);
    setAddedIds(prev => new Set(prev).add(index));
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">🐕 Find Activities</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs p-1">✕</button>
      </div>

      {/* Type selector */}
      {!selectedType && (
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(({ type, label, emoji }) => (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              className="flex flex-col items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors text-xs"
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-6 text-sm text-gray-500">
          <p className="text-xl mb-1">🐕</p>
          Scout is looking…
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}

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

      {/* Results */}
      {suggestions.length > 0 && (
        <>
          <button
            onClick={() => { setSelectedType(null); setSuggestions([]); setAddedIds(new Set()); }}
            className="text-xs text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
          >
            ← Change type
          </button>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.location}</p>
                    <p className="text-xs text-gray-600 mt-1">{s.why}</p>
                    {!s.geocoded && (
                      <p className="text-xs text-amber-600 mt-1">⚠️ Couldn&apos;t verify location</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAdd(s, i)}
                    disabled={!s.geocoded || addedIds.has(i)}
                    className={`flex-shrink-0 text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                      addedIds.has(i)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {addedIds.has(i) ? '✓ Added' : '+ Add'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
