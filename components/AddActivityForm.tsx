'use client';

import { useState, useEffect } from 'react';
import { useTrip } from '@/lib/store';
import { ActivityType, Coordinates, Activity, CampingSpot } from '@/types';

interface AddActivityFormProps {
  coordinates: Coordinates;
  onClose: () => void;
}

export default function AddActivityForm({ coordinates, onClose }: AddActivityFormProps) {
  const { trip, addActivity, selectedDay } = useTrip();
  const [name, setName] = useState('');
  const [type, setType] = useState<ActivityType>('trail');
  const [isDogFriendly, setIsDogFriendly] = useState(true);
  const [notes, setNotes] = useState('');
  const [coordinateInput, setCoordinateInput] = useState('');
  const [parsedCoords, setParsedCoords] = useState<Coordinates>(coordinates);

  // Camping-specific fields
  const [sourceLink, setSourceLink] = useState('');
  const [amenities, setAmenities] = useState({
    free: false,
    fireRing: false,
    cellCoverage: false,
    water: false,
  });

  const currentDayNumber = selectedDay || 1;

  // Parse coordinate input (e.g., "38.7234, -109.3421")
  const parseCoordinates = (input: string): Coordinates | null => {
    const match = input.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    return null;
  };

  useEffect(() => {
    if (coordinateInput) {
      const parsed = parseCoordinates(coordinateInput);
      if (parsed) {
        setParsedCoords(parsed);
      }
    } else {
      setParsedCoords(coordinates);
    }
  }, [coordinateInput, coordinates]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter an activity name');
      return;
    }

    const baseActivity = {
      id: crypto.randomUUID(),
      type,
      name: name.trim(),
      coordinates: parsedCoords,
      dayNumber: currentDayNumber,
      isDogFriendly,
      notes: notes.trim() || undefined,
    };

    let activity: Activity;

    if (type === 'camping') {
      activity = {
        ...baseActivity,
        type: 'camping',
        sourceLink: sourceLink.trim() || undefined,
        amenities,
      } as CampingSpot;
    } else {
      activity = baseActivity as Activity;
    }

    addActivity(activity);
    onClose();
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Add Activity</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Activity Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Activity Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ActivityType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="trail">🥾 Trail</option>
            <option value="hotel">🏨 Hotel</option>
            <option value="restaurant">🍽️ Restaurant</option>
            <option value="camping">⛺ Camping</option>
            <option value="park">🏞️ Park</option>
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Angels Landing Trail"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Coordinate Paste */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Coordinates (optional)
          </label>
          <input
            type="text"
            value={coordinateInput}
            onChange={(e) => setCoordinateInput(e.target.value)}
            placeholder="38.7234, -109.3421"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Paste from OnX or leave blank to use clicked location
          </p>
        </div>

        {/* Current Coordinates Display */}
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          Using: {parsedCoords.lat.toFixed(4)}, {parsedCoords.lng.toFixed(4)}
        </div>

        {/* Camping-Specific Fields */}
        {type === 'camping' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Link (optional)
              </label>
              <input
                type="url"
                value={sourceLink}
                onChange={(e) => setSourceLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amenities
              </label>
              <div className="space-y-2">
                {[
                  { key: 'free', label: 'Free' },
                  { key: 'fireRing', label: 'Fire Ring' },
                  { key: 'cellCoverage', label: 'Cell Coverage' },
                  { key: 'water', label: 'Water' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={amenities[key as keyof typeof amenities]}
                      onChange={(e) =>
                        setAmenities({ ...amenities, [key]: e.target.checked })
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Dog Friendly */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isDogFriendly}
              onChange={(e) => setIsDogFriendly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">
              🐕 Dog-friendly
            </span>
          </label>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Day Assignment */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-gray-700">
            Adding to <strong>Day {currentDayNumber}</strong>
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Activity
          </button>
        </div>
      </form>
    </div>
  );
}
