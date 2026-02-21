'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTrip } from '@/lib/store';
import { Activity, Coordinates, ActivityType, DrivingActivity } from '@/types';
import AddActivityForm from './AddActivityForm';
import MarkerInfoWindow from './MarkerInfoWindow';

interface MapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

// Marker colors by activity type
const markerColors: Record<ActivityType, string> = {
  trail: '#10b981', // green
  hotel: '#3b82f6', // blue
  restaurant: '#f97316', // orange
  camping: '#92400e', // brown
  park: '#059669', // dark green
  driving: '#6b7280', // gray
};

// Default map center (USA center)
const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };

// Singleton promise so the script loads only once across all renders/mounts
let googleMapsPromise: Promise<typeof google.maps> | null = null;

function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    // If already loaded (e.g. HMR), resolve immediately
    if (window.google?.maps?.Map) {
      resolve(window.google.maps);
      return;
    }

    const callbackName = '__initGoogleMaps_' + Date.now();
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsPromise = null;
      delete (window as unknown as Record<string, unknown>)[callbackName];
      reject(new Error('Google Maps script failed to load. Check your API key and internet connection.'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export default function TripMap(props: MapProps = {}) {
  const {
    center = DEFAULT_CENTER,
    zoom = 5,
    className = 'w-full h-full'
  } = props;
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<Coordinates | null>(null);

  // Info window state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Layer filter state (all on by default)
  const [showActivities, setShowActivities] = useState(true);
  const [showDriving, setShowDriving] = useState(true);
  const [showLodging, setShowLodging] = useState(true);

  // Day selector state — empty array means "All Days"
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Markers
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  // Polylines for routes
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  // Dashed polylines for driving activity start→end segments
  const drivingPolylinesRef = useRef<google.maps.Polyline[]>([]);

  // Drive time cache and InfoWindow for hover tooltips
  const driveTimeCache = useRef<Map<string, string>>(new Map());
  const driveTimeInfoWindow = useRef<google.maps.InfoWindow | null>(null);

  const { trip, selectedDay } = useTrip();

  // Helper: is a given day number currently selected?
  const isDaySelected = (dayNum: number) =>
    selectedDays.length === 0 || selectedDays.includes(dayNum);

  // Helper: show a drive time InfoWindow at a given position
  const showDriveTimeTooltip = useCallback((position: google.maps.LatLng | null, label: string) => {
    if (!map || !position) return;

    if (!driveTimeInfoWindow.current) {
      driveTimeInfoWindow.current = new google.maps.InfoWindow();
    }

    driveTimeInfoWindow.current.setContent(`<div style="font-size:13px;padding:2px 4px">${label}</div>`);
    driveTimeInfoWindow.current.setPosition(position);
    driveTimeInfoWindow.current.open(map);
  }, [map]);

  // Initialize map
  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        if (!apiKey || apiKey === 'your_api_key_here' || apiKey.length < 20) {
          if (!cancelled) {
            setError('Google Maps API key is missing or invalid. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local and restart the dev server.');
            setLoading(false);
          }
          return;
        }

        const maps = await loadGoogleMaps(apiKey);

        if (cancelled || !mapRef.current) return;

        const mapInstance = new maps.Map(mapRef.current, {
          center,
          zoom,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true,
        });

        // Click to add activity
        mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            setClickedCoords({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            setShowAddForm(true);
            setSelectedActivity(null);
          }
        });

        if (!cancelled) {
          setMap(mapInstance);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('Error loading Google Maps:', err);
        if (!cancelled) {
          setError((err as Error)?.message || 'Failed to load Google Maps. Check your API key and internet connection.');
          setLoading(false);
        }
      }
    };

    initMap();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // Update markers when trip activities or filters change
  useEffect(() => {
    if (!map || !trip) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    const allActivities = trip.days.flatMap(day => day.activities).filter(a => {
      if (a.showOnMap === false) return false;
      if (!isDaySelected(a.dayNumber)) return false;

      if (a.type === 'driving') return showDriving;
      if (a.type === 'hotel') return showLodging;
      // trail, restaurant, park, camping → Activities layer
      return showActivities;
    });

    allActivities.forEach(activity => {
      const marker = new google.maps.Marker({
        position: activity.coordinates,
        map,
        title: activity.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: markerColors[activity.type],
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        setSelectedActivity(activity);
        setShowAddForm(false);
      });

      markersRef.current.set(activity.id, marker);
    });

    // Fit map to show all visible markers
    if (allActivities.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allActivities.forEach(activity => bounds.extend(activity.coordinates));
      map.fitBounds(bounds);
    }
  }, [map, trip, showActivities, showDriving, showLodging, selectedDays]);

  // Draw routes between activities in each day
  useEffect(() => {
    if (!map || !trip) return;

    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    const dayColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

    trip.days.forEach((day, index) => {
      if (!isDaySelected(day.dayNumber)) return;

      const visibleActivities = day.activities.filter(a => a.showOnMap !== false);
      if (visibleActivities.length < 2) return;

      const polyline = new google.maps.Polyline({
        path: visibleActivities.map(a => a.coordinates),
        geodesic: true,
        strokeColor: dayColors[index % dayColors.length],
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map,
      });

      polylinesRef.current.push(polyline);
    });
  }, [map, trip, selectedDays]);

  // Dashed polylines for driving activity start→end
  useEffect(() => {
    if (!map || !trip) return;

    drivingPolylinesRef.current.forEach(p => p.setMap(null));
    drivingPolylinesRef.current = [];

    if (!showDriving) return;

    const allActivities = trip.days
      .flatMap(d => d.activities)
      .filter(a => a.showOnMap !== false && a.type === 'driving' && isDaySelected(a.dayNumber));

    const drivingActivities = allActivities as DrivingActivity[];

    drivingActivities.forEach(drive => {
      const polyline = new google.maps.Polyline({
        path: [drive.startLocation.coordinates, drive.endLocation.coordinates],
        geodesic: true,
        strokeColor: '#6b7280',
        strokeOpacity: 0,
        strokeWeight: 0,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            scale: 3,
          },
          offset: '0',
          repeat: '20px',
        }],
        map,
      });
      drivingPolylinesRef.current.push(polyline);

      const cacheKey = `${drive.startLocation.coordinates.lat},${drive.startLocation.coordinates.lng}→${drive.endLocation.coordinates.lat},${drive.endLocation.coordinates.lng}`;

      polyline.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
        // Check cache first
        if (driveTimeCache.current.has(cacheKey)) {
          showDriveTimeTooltip(e.latLng, driveTimeCache.current.get(cacheKey)!);
          return;
        }

        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
          origins: [drive.startLocation.coordinates],
          destinations: [drive.endLocation.coordinates],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.IMPERIAL,
        }, (result, status) => {
          if (status === 'OK' && result) {
            const element = result.rows[0]?.elements[0];
            if (element?.status === 'OK') {
              const label = `🚗 ${element.duration?.text} · ${element.distance?.text}`;
              driveTimeCache.current.set(cacheKey, label);
              showDriveTimeTooltip(e.latLng, label);
            }
          }
        });
      });

      polyline.addListener('mouseout', () => {
        driveTimeInfoWindow.current?.close();
      });
    });
  }, [map, trip, showDriving, selectedDays, showDriveTimeTooltip]);

  // Fit map to selected day's activities when selectedDay changes
  useEffect(() => {
    if (!map || !trip || !selectedDay) return;
    const day = trip.days.find(d => d.dayNumber === selectedDay);
    if (!day || day.activities.length === 0) return;

    if (day.activities.length === 1) {
      map.panTo(day.activities[0].coordinates);
      map.setZoom(12);
    } else {
      const bounds = new google.maps.LatLngBounds();
      day.activities.forEach(a => bounds.extend(a.coordinates));
      map.fitBounds(bounds, 80);
    }
  }, [selectedDay, map, trip]);

  return (
    <>
      {/* Map wrapper: relative so the filter overlay can be positioned absolutely inside it */}
      <div className={`${className} relative`} style={{ visibility: (loading || error) ? 'hidden' : 'visible' }}>
        <div ref={mapRef} style={{ height: '100%' }} />

        {/* Filter overlay panel — top-right corner */}
        {trip && !loading && !error && (
          <div className="absolute top-2 right-2 z-10 bg-white rounded-lg shadow-md p-3 text-sm min-w-[160px]">
            <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Layers</p>

            <label className="flex items-center gap-2 cursor-pointer mb-1">
              <input
                type="checkbox"
                checked={showActivities}
                onChange={e => setShowActivities(e.target.checked)}
              />
              <span>🏔️ Activities</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer mb-1">
              <input
                type="checkbox"
                checked={showDriving}
                onChange={e => setShowDriving(e.target.checked)}
              />
              <span>🚗 Driving</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={showLodging}
                onChange={e => setShowLodging(e.target.checked)}
              />
              <span>🏨 Lodging</span>
            </label>

            <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide border-t pt-2">Days</p>

            <div className="flex flex-wrap gap-1">
              {/* All Days chip */}
              <button
                onClick={() => setSelectedDays([])}
                className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  selectedDays.length === 0
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
                }`}
              >
                All
              </button>

              {/* Individual day chips */}
              {trip.days.map(day => (
                <button
                  key={day.dayNumber}
                  onClick={() => {
                    setSelectedDays(prev =>
                      prev.includes(day.dayNumber)
                        ? prev.filter(d => d !== day.dayNumber)
                        : [...prev, day.dayNumber]
                    );
                  }}
                  className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    selectedDays.includes(day.dayNumber)
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
                  }`}
                >
                  {day.dayNumber}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className={`${className} absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg`}>
          <div className="text-center p-8 max-w-md">
            <p className="text-red-600 font-semibold mb-2">Map Error</p>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                googleMapsPromise = null; // allow re-attempt
                setError(null);
                setLoading(true);
                setRetryKey(k => k + 1);
              }}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {loading && !error && (
        <div className={`${className} absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg min-h-[200px]`}>
          <div className="text-center px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Add Activity Form Overlay */}
      {showAddForm && clickedCoords && typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <AddActivityForm
              coordinates={clickedCoords}
              onClose={() => {
                setShowAddForm(false);
                setClickedCoords(null);
              }}
            />
          </div>,
          document.body
        )}

      {/* Marker Info Window Overlay */}
      {selectedActivity && typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <MarkerInfoWindow
              activity={selectedActivity}
              onClose={() => setSelectedActivity(null)}
            />
          </div>,
          document.body
        )}
    </>
  );
}
