'use client';

import { useState, useEffect } from 'react';
import { useTrip } from '@/lib/store';
import { ActivityType, Coordinates, Activity, CampingSpot, DrivingActivity } from '@/types';
import PlacesAutocomplete from './PlacesAutocomplete';
import { geocodePlace } from '@/lib/geocoding';

interface AddActivityFormProps {
  coordinates?: Coordinates;
  onClose: () => void;
}

export default function AddActivityForm({ coordinates, onClose }: AddActivityFormProps) {
  const { addActivity, selectedDay } = useTrip();
  const [name, setName] = useState('');
  const [type, setType] = useState<ActivityType>('trail');
  const [isDogFriendly, setIsDogFriendly] = useState(true);
  const [notes, setNotes] = useState('');
  const [coordinateInput, setCoordinateInput] = useState('');
  const [parsedCoords, setParsedCoords] = useState<Coordinates | null>(coordinates ?? null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Driving-specific fields
  const [driveStartInput, setDriveStartInput] = useState('');
  const [driveEndInput, setDriveEndInput] = useState('');
  const [driveStart, setDriveStart] = useState<{ name: string; coordinates: Coordinates } | null>(null);
  const [driveEnd, setDriveEnd] = useState<{ name: string; coordinates: Coordinates } | null>(null);

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

  useEffect(() => {
    if (coordinateInput) {
      const parsed = parseCoordinates(coordinateInput);
      if (parsed) {
        setParsedCoords(parsed);
      }
    } else {
      setParsedCoords(coordinates ?? null);
    }
  }, [coordinateInput, coordinates]);

  const handlePlaceSelected = (result: { name: string; coordinates: { lat: number; lng: number } }) => {
    setName(result.name);
    setParsedCoords(result.coordinates);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Skip name validation for driving type (name is auto-generated)
    if (type !== 'driving' && !name.trim()) {
      alert('Please enter an activity name');
      return;
    }

    if (type === 'driving') {
      if (!driveStart || !driveEnd) {
        alert('Please select both start and end locations');
        return;
      }
      const driveName = `Drive: ${driveStart.name} → ${driveEnd.name}`;
      const activity: Activity = {
        id: crypto.randomUUID(),
        type: 'driving',
        name: driveName,
        coordinates: driveStart.coordinates,
        dayNumber: currentDayNumber,
        isDogFriendly: true,
        notes: notes.trim() || undefined,
        startLocation: driveStart,
        endLocation: driveEnd,
      } as DrivingActivity;
      addActivity(activity);
      onClose();
      return;
    }

    if (!parsedCoords) {
      alert('Please resolve a location first — type a name and click 📍, or select from the dropdown');
      return;
    }

    const baseActivity = {
      id: crypto.randomUUID(),
      type,
      name: name.trim(),
      coordinates: parsedCoords!, // safe — validated above
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
            <option value="driving">🚗 Driving</option>
          </select>
        </div>

        {/* Name */}
        {type !== 'driving' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <div className="flex gap-2">
              <PlacesAutocomplete
                value={name}
                onChange={(val) => {
                  setName(val);
                  setGeocodeStatus('idle');
                }}
                onPlaceSelected={handlePlaceSelected}
                placeholder="e.g., Angels Landing Trail"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!coordinates && (
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={isGeocoding || !name.trim()}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 disabled:opacity-50 transition-colors"
                  title="Resolve location"
                >
                  {isGeocoding ? '…' : '📍'}
                </button>
              )}
            </div>
            {geocodeStatus === 'success' && (
              <p className="text-xs text-green-600 mt-1">Location resolved ✓</p>
            )}
            {geocodeStatus === 'error' && (
              <p className="text-xs text-red-500 mt-1">Location not found — try a more specific name</p>
            )}
            {coordinates && (
              <p className="text-xs text-gray-400 mt-1">📍 Select from dropdown to auto-fill location</p>
            )}
          </div>
        )}

        {type === 'driving' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Location</label>
              <PlacesAutocomplete
                value={driveStartInput}
                onChange={setDriveStartInput}
                onPlaceSelected={result => {
                  setDriveStart(result);
                  setDriveStartInput(result.name);
                }}
                placeholder="e.g., Moab, UT"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {driveStart && <p className="text-xs text-green-600 mt-1">✓ {driveStart.coordinates.lat.toFixed(4)}, {driveStart.coordinates.lng.toFixed(4)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Location</label>
              <PlacesAutocomplete
                value={driveEndInput}
                onChange={setDriveEndInput}
                onPlaceSelected={result => {
                  setDriveEnd(result);
                  setDriveEndInput(result.name);
                }}
                placeholder="e.g., Capitol Reef National Park"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {driveEnd && <p className="text-xs text-green-600 mt-1">✓ {driveEnd.coordinates.lat.toFixed(4)}, {driveEnd.coordinates.lng.toFixed(4)}</p>}
            </div>
            {driveStart && driveEnd && (
              <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
                🚗 Drive: {driveStartInput} → {driveEndInput}
              </p>
            )}
          </div>
        )}

        {/* Coordinate Paste */}
        {type !== 'driving' && (
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
        )}

        {/* Current Coordinates Display */}
        {type !== 'driving' && parsedCoords && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            Using: {parsedCoords.lat.toFixed(4)}, {parsedCoords.lng.toFixed(4)}
          </div>
        )}

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
