'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTrip } from '@/lib/store';
import { Activity, Coordinates, ActivityType } from '@/types';
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
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsPromise = null;
      delete (window as any)[callbackName];
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

  // Markers
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  // Polylines for routes
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const { trip } = useTrip();

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
      } catch (err: any) {
        console.error('Error loading Google Maps:', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load Google Maps. Check your API key and internet connection.');
          setLoading(false);
        }
      }
    };

    initMap();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // Update markers when trip activities change
  useEffect(() => {
    if (!map || !trip) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    const allActivities = trip.days.flatMap(day => day.activities);

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

    // Fit map to show all markers
    if (allActivities.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allActivities.forEach(activity => bounds.extend(activity.coordinates));
      map.fitBounds(bounds);
    }
  }, [map, trip]);

  // Draw routes between activities in each day
  useEffect(() => {
    if (!map || !trip) return;

    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    const dayColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

    trip.days.forEach((day, index) => {
      if (day.activities.length < 2) return;

      const polyline = new google.maps.Polyline({
        path: day.activities.map(a => a.coordinates),
        geodesic: true,
        strokeColor: dayColors[index % dayColors.length],
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map,
      });

      polylinesRef.current.push(polyline);
    });
  }, [map, trip]);

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`}>
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
    );
  }

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg min-h-[200px]`}>
        <div className="text-center px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={mapRef} className={className} />

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
