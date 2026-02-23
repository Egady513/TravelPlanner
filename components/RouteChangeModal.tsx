'use client';

import { useTrip, RouteChangePayload } from '@/lib/store';
import type { Day } from '@/types';
import { useEffect, useRef } from 'react';

interface RouteChangeModalProps {
  payload: RouteChangePayload;
  onAccept: () => void;
  onDismiss: () => void;
}

function DayPreviewCard({ day, label }: { day: Day; label: string }) {
  return (
    <div className="border rounded-lg p-3 bg-white">
      <p className="text-xs font-bold text-gray-500 uppercase mb-1">{label}</p>
      <p className="font-semibold text-gray-900 mb-2">Day {day.dayNumber}</p>
      <ul className="space-y-1">
        {day.activities.map(a => (
          <li key={a.id} className="text-xs text-gray-600 flex items-center gap-1">
            <span>{a.type === 'driving' ? '🚗' : a.type === 'hotel' ? '🏨' : a.type === 'camping' ? '⛺' : '📍'}</span>
            {a.name}
          </li>
        ))}
        {day.activities.length === 0 && (
          <li className="text-xs text-gray-400 italic">No activities</li>
        )}
      </ul>
    </div>
  );
}

export default function RouteChangeModal({ payload, onAccept, onDismiss }: RouteChangeModalProps) {
  const { trip, applyRouteChange } = useTrip();
  const mapRef = useRef<HTMLDivElement>(null);

  // Get affected days from current trip (BEFORE state)
  const beforeDays = payload.affected_day_numbers
    .map(n => trip?.days.find(d => d.dayNumber === n))
    .filter(Boolean) as Day[];

  // AFTER state: the affected days from the new_days payload
  const afterDays = payload.new_days.filter(d =>
    payload.affected_day_numbers.includes(d.dayNumber) ||
    // Also include any new days inserted between affected day numbers
    (d.dayNumber > Math.min(...payload.affected_day_numbers) &&
     d.dayNumber <= Math.max(...payload.affected_day_numbers) + 1)
  );

  // Mini map: draw before (orange) and after (green) routes
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 6,
      center: { lat: 39.8283, lng: -98.5795 },
      disableDefaultUI: true,
      gestureHandling: 'none',
    });

    const allCoords = [
      ...beforeDays.flatMap(d => d.activities.map(a => a.coordinates)),
      ...afterDays.flatMap(d => d.activities.map(a => a.coordinates)),
    ];

    if (allCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allCoords.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, 40);
    }

    // Draw before route (orange, dashed)
    if (beforeDays.length > 0) {
      const coords = beforeDays.flatMap(d => d.activities.map(a => a.coordinates));
      new google.maps.Polyline({
        path: coords,
        strokeColor: '#f97316',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map,
      });
    }

    // Draw after route (green)
    if (afterDays.length > 0) {
      const coords = afterDays.flatMap(d => d.activities.map(a => a.coordinates));
      new google.maps.Polyline({
        path: coords,
        strokeColor: '#10b981',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccept = () => {
    applyRouteChange(payload);
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">🗺️ Route Change Preview</h2>
            <p className="text-sm text-gray-500 mt-0.5">{payload.reason}</p>
          </div>
          <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Mini map */}
        <div ref={mapRef} className="w-full h-48 bg-gray-100" />

        {/* Map legend */}
        <div className="px-6 py-2 flex items-center gap-4 text-xs text-gray-500 bg-gray-50 border-b">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-1 bg-orange-500 rounded" /> Current route
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-1 bg-emerald-500 rounded" /> Proposed route
          </span>
        </div>

        {/* BEFORE / AFTER day cards */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Before</p>
              <div className="space-y-2">
                {beforeDays.map(d => (
                  <DayPreviewCard key={d.dayNumber} day={d} label={`Day ${d.dayNumber}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase mb-2">After</p>
              <div className="space-y-2">
                {afterDays.map(d => (
                  <DayPreviewCard key={d.dayNumber} day={d} label={`Day ${d.dayNumber}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 bg-emerald-500 text-white py-2.5 rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
          >
            Accept Change
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 bg-white text-gray-700 py-2.5 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
