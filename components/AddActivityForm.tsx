'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTrip } from '@/lib/store';
import { ActivityType, Coordinates, Activity, CampingSpot, DrivingActivity, Hotel } from '@/types';
import PlacesAutocomplete from './PlacesAutocomplete';
import { geocodePlace } from '@/lib/geocoding';

interface AddActivityFormProps {
  coordinates?: Coordinates;
  onClose: () => void;
  existingActivity?: Activity;
}

export default function AddActivityForm({ coordinates, onClose, existingActivity }: AddActivityFormProps) {
  const { addActivity, selectedDay, trip, updateActivity } = useTrip();

  // Driving-specific cast (used for initializing state)
  const existingDrive = existingActivity as DrivingActivity | undefined;
  // Camping-specific cast
  const existingCamping = existingActivity as CampingSpot | undefined;
  // Hotel/camping pricing cast
  const existingLodging = existingActivity as (Hotel | CampingSpot) | undefined;

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
  const [estimatedDriveDistance, setEstimatedDriveDistance] = useState<string>(
    existingDrive?.estimatedDriveDistance ?? ''
  );
  const [isEstimatingDriveTime, setIsEstimatingDriveTime] = useState(false);
  const [departureTime, setDepartureTime] = useState<string>(
    existingDrive?.departureTime ?? ''
  );
  const [arrivalTime, setArrivalTime] = useState<string>(
    existingDrive?.arrivalTime ?? ''
  );

  // Camping-specific
  const [sourceLink, setSourceLink] = useState(existingCamping?.sourceLink ?? '');
  const [amenities, setAmenities] = useState(
    existingCamping?.amenities ?? { free: false, fireRing: false, cellCoverage: false, water: false }
  );

  // Hotel/camping pricing
  const [pricePerNight, setPricePerNight] = useState<number | undefined>(existingLodging?.pricePerNight);
  const [nights, setNights] = useState<number>(existingLodging?.nights ?? 1);

  // Ticket tracking
  const [requiresTickets, setRequiresTickets] = useState(existingActivity?.requiresTickets ?? false);
  const [ticketsPurchased, setTicketsPurchased] = useState(existingActivity?.ticketsPurchased ?? false);

  const currentDayNumber = selectedDay || 1;

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
      setParsedCoords(existingActivity?.coordinates ?? coordinates ?? null);
    }
  }, [coordinateInput, coordinates]);

  // Auto-fill driving start from previous day's endpoint
  useEffect(() => {
    if (type !== 'driving' || !trip || currentDayNumber <= 1 || driveStart) return;

    const prevDay = trip.days.find(d => d.dayNumber === currentDayNumber - 1);
    if (!prevDay) return;

    // Priority 1: last driving activity's endLocation on the previous day
    const prevDrives = prevDay.activities.filter(a => a.type === 'driving') as DrivingActivity[];
    if (prevDrives.length > 0) {
      const end = prevDrives[prevDrives.length - 1].endLocation;
      setDriveStart(end);
      setDriveStartInput(end.name);
      return;
    }

    // Priority 2: hotel or camping lodging on previous day
    const prevLodging = prevDay.activities.find(a => a.type === 'hotel' || a.type === 'camping');
    if (prevLodging) {
      const loc = { name: prevLodging.name, coordinates: prevLodging.coordinates };
      setDriveStart(loc);
      setDriveStartInput(prevLodging.name);
    }
  }, [type]);

  // Estimate drive time when both endpoints are set
  useEffect(() => {
    if (!driveStart || !driveEnd) return;

    const service = window.google?.maps?.DistanceMatrixService
      ? new window.google.maps.DistanceMatrixService()
      : null;
    if (!service) return;

    setIsEstimatingDriveTime(true);
    setEstimatedDriveHours(null);
    setEstimatedDriveDistance('');

    service.getDistanceMatrix(
      {
        origins: [driveStart.coordinates],
        destinations: [driveEnd.coordinates],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
      },
      (result: google.maps.DistanceMatrixResponse | null, status: google.maps.DistanceMatrixStatus) => {
        if (status === 'OK' && result) {
          const el = result.rows[0]?.elements[0];
          if (el?.status === 'OK') {
            const hours = Math.round((el.duration.value / 3600) * 10) / 10;
            setEstimatedDriveHours(hours);
            setEstimatedDriveDistance(el.distance?.text ?? '');
          }
        }
        setIsEstimatingDriveTime(false);
      }
    );
  }, [driveStart, driveEnd]);

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
        id: existingActivity ? existingActivity.id : crypto.randomUUID(),
        type: 'driving',
        name: driveName,
        coordinates: driveStart.coordinates,
        dayNumber: currentDayNumber,
        isDogFriendly: true,
        notes: notes.trim() || undefined,
        startLocation: driveStart,
        endLocation: driveEnd,
        estimatedDriveHours: estimatedDriveHours ?? undefined,
        estimatedDriveDistance: estimatedDriveDistance.trim() || undefined,
        departureTime: departureTime || undefined,
        arrivalTime: arrivalTime || undefined,
      } as DrivingActivity;
      if (existingActivity) {
        updateActivity(existingActivity.id, activity as Partial<Activity>);
      } else {
        addActivity(activity);
      }
      onClose();
      return;
    }

    if (!parsedCoords) {
      alert('Please resolve a location first — type a name and click 📍, or select from the dropdown');
      return;
    }

    const baseActivity = {
      id: existingActivity ? existingActivity.id : crypto.randomUUID(),
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
        pricePerNight,
        nights: nights > 1 ? nights : undefined,
      } as CampingSpot;
    } else if (type === 'hotel') {
      activity = {
        ...baseActivity,
        type: 'hotel',
        pricePerNight,
        nights: nights > 1 ? nights : undefined,
      } as Activity;
    } else if (type === 'trail' || type === 'park' || type === 'restaurant') {
      activity = {
        ...baseActivity,
        requiresTickets,
        ticketsPurchased: requiresTickets ? ticketsPurchased : undefined,
      } as Activity;
    } else {
      activity = baseActivity as Activity;
    }

    if (existingActivity) {
      updateActivity(existingActivity.id, activity as Partial<Activity>);
    } else {
      addActivity(activity);
    }
    onClose();
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{existingActivity ? 'Edit Activity' : 'Add Activity'}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row: Type + Dog Friendly */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <option value="activity">🎡 Activity / Event</option>
              <option value="scenic">🌄 Scenic Drive</option>
            </select>
          </div>
          <div className="flex items-end pb-1">
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
                locationBias={locationBias}
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
                locationBias={locationBias}
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
                locationBias={locationBias}
              />
              {driveEnd && <p className="text-xs text-green-600 mt-1">✓ {driveEnd.coordinates.lat.toFixed(4)}, {driveEnd.coordinates.lng.toFixed(4)}</p>}
              {isEstimatingDriveTime && (
                <p className="text-xs text-gray-500 mt-1">Estimating drive time…</p>
              )}
              {!isEstimatingDriveTime && estimatedDriveHours !== null && (
                <p className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded mt-1">
                  🚗 ~{estimatedDriveHours}h{estimatedDriveDistance ? ` · ${estimatedDriveDistance}` : ''}
                </p>
              )}
            </div>
            {driveStart && driveEnd && (
              <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
                🚗 Drive: {driveStartInput} → {driveEndInput}
              </p>
            )}
            {/* Departure / Arrival Times */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={e => setDepartureTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Est. Arrival Time</label>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={e => setArrivalTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                {departureTime && estimatedDriveHours && !arrivalTime && (
                  <button
                    type="button"
                    onClick={() => {
                      const [h, m] = departureTime.split(':').map(Number);
                      const totalMins = h * 60 + m + Math.round(estimatedDriveHours * 60);
                      const ah = Math.floor(totalMins / 60) % 24;
                      const am = totalMins % 60;
                      setArrivalTime(`${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`);
                    }}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    Auto-calculate from departure + drive time
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hotel: Price per night + nights */}
        {type === 'hotel' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price per night ($)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={pricePerNight ?? ''}
                onChange={(e) => setPricePerNight(e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="e.g., 120"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nights
              </label>
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={nights}
                onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price per night ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={pricePerNight ?? ''}
                  onChange={(e) => setPricePerNight(e.target.value === '' ? undefined : Number(e.target.value))}
                  placeholder="e.g., 25"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nights
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={nights}
                  onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

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

        {/* Ticket tracking (trail, park, restaurant) */}
        {(type === 'trail' || type === 'park' || type === 'restaurant') && (
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={requiresTickets}
                onChange={(e) => {
                  setRequiresTickets(e.target.checked);
                  if (!e.target.checked) setTicketsPurchased(false);
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Requires tickets/reservation?
              </span>
            </label>
            {requiresTickets && (
              <label className="flex items-center ml-4">
                <input
                  type="checkbox"
                  checked={ticketsPurchased}
                  onChange={(e) => setTicketsPurchased(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Already purchased?</span>
              </label>
            )}
          </div>
        )}

        {/* Row: Notes + Day Assignment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="flex items-start pt-6">
            <div className="w-full bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-gray-700">
                Adding to <strong>Day {currentDayNumber}</strong>
              </p>
            </div>
          </div>
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
            {existingActivity ? 'Save Changes' : 'Add Activity'}
          </button>
        </div>
      </form>
    </div>
  );
}
