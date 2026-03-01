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
      if (!coords) {
        setError('Could not locate this place. Try another suggestion.');
        return;
      }

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
    setGeocodingIds(new Set());
  };

  if (typeof window === 'undefined') return null;

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
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl opacity-30">
                          {typeOptions.find(t => t.type === selectedType)?.emoji}
                        </span>
                      </div>
                      {s.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.photoUrl}
                          alt={s.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
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

  return createPortal(modal, document.body);
}
