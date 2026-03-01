'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTrip } from '@/lib/store';
import type { TripPreferences } from '@/types';

interface Props {
  onClose: () => void;
}

const INTEREST_FIELDS: { key: keyof Omit<TripPreferences, 'customInterests'>; label: string; emoji: string }[] = [
  { key: 'hiking', label: 'Hiking & Trails', emoji: '🥾' },
  { key: 'museums', label: 'Museums & History', emoji: '🏛️' },
  { key: 'wineries', label: 'Wineries & Breweries', emoji: '🍷' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { key: 'restaurants', label: 'Food & Dining', emoji: '🍽️' },
  { key: 'outdoorAdventure', label: 'Outdoor Adventure', emoji: '🏔️' },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          className={`text-xl transition-colors ${n <= value ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function PreferencesModal({ onClose }: Props) {
  const { trip, updatePreferences } = useTrip();
  const prefs = trip?.preferences;
  const [ratings, setRatings] = useState<Omit<TripPreferences, 'customInterests'>>({
    hiking: prefs?.hiking ?? 0,
    museums: prefs?.museums ?? 0,
    wineries: prefs?.wineries ?? 0,
    shopping: prefs?.shopping ?? 0,
    restaurants: prefs?.restaurants ?? 0,
    outdoorAdventure: prefs?.outdoorAdventure ?? 0,
  });
  const [customInput, setCustomInput] = useState('');
  const [customInterests, setCustomInterests] = useState<string[]>(prefs?.customInterests ?? []);

  const handleSave = () => {
    updatePreferences({ ...ratings, customInterests });
    onClose();
  };

  const addCustomInterest = () => {
    const tag = customInput.trim().toLowerCase();
    if (tag && !customInterests.includes(tag)) {
      setCustomInterests(prev => [...prev, tag]);
    }
    setCustomInput('');
  };

  if (typeof window === 'undefined') return null;

  const modal = (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Your Interests</h2>
            <p className="text-sm text-gray-500">Scout uses these to personalize recommendations</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-lg" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {INTEREST_FIELDS.map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{emoji} {label}</span>
              <StarRating
                value={ratings[key]}
                onChange={v => setRatings(prev => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Other interests</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomInterest(); } }}
                placeholder="e.g., crossfit, craft beer, photography"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                type="button"
                onClick={addCustomInterest}
                className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-orange-600"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {customInterests.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                  {tag}
                  <button onClick={() => setCustomInterests(prev => prev.filter(t => t !== tag))} className="hover:text-orange-900 leading-none" aria-label={`Remove ${tag}`}>✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t p-4 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600">Save Preferences</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
