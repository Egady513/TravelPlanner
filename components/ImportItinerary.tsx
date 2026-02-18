'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTrip } from '@/lib/store';
import { geocodePlace } from '@/lib/geocoding';
import { parseLocalDate } from '@/lib/dateUtils';
import { ActivityType, Trip, Day, Activity } from '@/types';

interface ImportedActivity {
  name: string;
  type: ActivityType;
  isDogFriendly: boolean;
  notes: string | null;
}

interface ImportedDay {
  dayNumber: number;
  date: string;
  activities: ImportedActivity[];
}

interface ImportResponse {
  tripName: string;
  startDate: string;
  endDate: string;
  hasDog: boolean;
  days: ImportedDay[];
}

interface ImportItineraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportItinerary({ isOpen, onClose }: ImportItineraryProps) {
  const { setTrip } = useTrip();
  const [text, setText] = useState('');
  const [step, setStep] = useState<'input' | 'parsing' | 'preview' | 'geocoding'>('input');
  const [parsed, setParsed] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseWithAI = async () => {
    setStep('parsing');
    setError(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error ?? 'Failed to parse itinerary');
      }
      const data = await res.json() as ImportResponse;
      setParsed(data);
      setStep('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse';
      setError(msg);
      setStep('input');
    }
  };

  const handleApplyToTrip = async () => {
    if (!parsed) return;
    setStep('geocoding');

    const CENTER_US = { lat: 39.8283, lng: -98.5795 };

    const days: Day[] = await Promise.all(
      parsed.days.map(async (importedDay) => {
        const activities: Activity[] = await Promise.all(
          importedDay.activities.map(async (importedActivity) => {
            const coords = await geocodePlace(importedActivity.name);
            return {
              id: crypto.randomUUID(),
              type: importedActivity.type,
              name: importedActivity.name,
              coordinates: coords ?? CENTER_US,
              dayNumber: importedDay.dayNumber,
              isDogFriendly: importedActivity.isDogFriendly,
              notes: importedActivity.notes ?? undefined,
            };
          })
        );

        return {
          dayNumber: importedDay.dayNumber,
          date: parseLocalDate(importedDay.date),
          activities,
          validationStatus: { level: 'success' as const, messages: [] },
        };
      })
    );

    const newTrip: Trip = {
      id: crypto.randomUUID(),
      name: parsed.tripName,
      startDate: parseLocalDate(parsed.startDate),
      endDate: parseLocalDate(parsed.endDate),
      days,
      hasDog: parsed.hasDog,
      isLoopTrip: false,
      peopleCount: 2,
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
  };

  const handleBack = () => {
    setStep('input');
    setParsed(null);
    setError(null);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Import Existing Plan</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Input step */}
          {step === 'input' && (
            <div className="flex flex-col gap-4">
              <p className="text-gray-600">
                Paste your existing itinerary below. The AI will parse it into days and activities.
              </p>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <textarea
                className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Paste your trip itinerary here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                onClick={handleParseWithAI}
                disabled={!text.trim()}
                className="self-end px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Parse with AI
              </button>
            </div>
          )}

          {/* Parsing step */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 font-medium">Parsing your itinerary...</p>
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && parsed && (
            <div className="flex flex-col gap-6">
              {/* Trip summary */}
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{parsed.tripName}</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                  <span>Start: {parsed.startDate}</span>
                  <span>End: {parsed.endDate}</span>
                  <span>{parsed.hasDog ? 'Dog friendly' : 'No dog'}</span>
                  <span>{parsed.days.length} day{parsed.days.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Days and activities */}
              <div className="flex flex-col gap-4">
                {parsed.days.map((day) => (
                  <div key={day.dayNumber} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <span className="font-medium text-gray-800">
                        Day {day.dayNumber} &mdash; {day.date}
                      </span>
                    </div>
                    {day.activities.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">No activities</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {day.activities.map((activity, idx) => (
                          <li key={idx} className="px-4 py-3 flex items-start gap-3">
                            <span className="mt-0.5 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full whitespace-nowrap">
                              {activity.type}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{activity.name}</p>
                              {activity.notes && (
                                <p className="text-xs text-gray-500 mt-0.5">{activity.notes}</p>
                              )}
                            </div>
                            {activity.isDogFriendly && (
                              <span className="text-xs text-green-600 whitespace-nowrap">dog ok</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Geocoding step */}
          {step === 'geocoding' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 font-medium">Geocoding activities...</p>
            </div>
          )}
        </div>

        {/* Footer (preview step only) */}
        {step === 'preview' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <button
              onClick={handleBack}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg border border-gray-300 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleApplyToTrip}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
            >
              Apply to Trip
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
