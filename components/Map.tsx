'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader } from '@googlemaps/js-api-loader';
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

// Default map center (USA center) - defined outside component to prevent recreating on each render
const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };

// Singleton Loader instance to avoid re-creating on each render
let loaderInstance: Loader | null = null;

export default function TripMap(props: MapProps = {}) {
  const {
    center = DEFAULT_CENTER,
    zoom = 5,
    className = 'w-full h-full'
  } = props;
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [showSlowLoadHint, setShowSlowLoadHint] = useState(false);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<Coordinates | null>(null);

  // Info window state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Markers
  const markersRef = useRef<Map<string, any>>(new Map());

  // Polylines for routes
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const { trip } = useTrip();

  // Initialize map
  useEffect(() => {
    const LOAD_TIMEOUT_MS = 20000; // 20 seconds
    let cancelled = false;

    const initMap = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        // Debug: Log API key status (without exposing the actual key)
        console.log('Google Maps API Key Status:', apiKey ? `Loaded (${apiKey.substring(0, 10)}...)` : 'Missing');

        if (!apiKey) {
          if (!cancelled) {
            setError('Google Maps API key is missing. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file and restart the dev server.');
            setLoading(false);
          }
          return;
        }

        // Check if API key looks valid (basic validation)
        if (apiKey === 'your_api_key_here' || apiKey.length < 20) {
          if (!cancelled) {
            setError('Invalid API key format. Please check your NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local file.');
            setLoading(false);
          }
          return;
        }

        // Create loader singleton
        if (!loaderInstance) {
          loaderInstance = new Loader({
            apiKey,
            version: 'weekly',
            libraries: ['places', 'geometry', 'marker'],
          });
        }

        // Load maps library with timeout so we don't hang forever
        const mapsPromise = loaderInstance.importLibrary('maps');
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('MAP_LOAD_TIMEOUT')), LOAD_TIMEOUT_MS)
        );

        const { Map } = await Promise.race([mapsPromise, timeoutPromise]) as any;

        if (cancelled || !mapRef.current) return;

        const mapInstance = new Map(mapRef.current, {
          center,
          zoom,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true,
        });

        // Add click listener for adding activities
        mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            setClickedCoords({
              lat: e.latLng.lat(),
              lng: e.latLng.lng(),
            });
            setShowAddForm(true);
            setSelectedActivity(null);
          }
        });

        if (!cancelled) {
          setMap(mapInstance);
          setLoading(false);
        }

        // Places, geometry, marker already requested via Loader constructor libraries option
      } catch (err: any) {
        console.error('Error loading Google Maps:', err);

        let errorMessage = 'Failed to load Google Maps. ';

        if (err?.message === 'MAP_LOAD_TIMEOUT') {
          errorMessage += 'The map took too long to load. ';
          errorMessage += 'Check: (1) API key has "Maps JavaScript API" enabled, (2) Billing is on for your Google Cloud project, (3) Application restrictions allow this site (e.g. localhost). ';
          errorMessage += 'Then click Retry below.';
        } else if (err?.message) {
          if (err.message.includes('InvalidKeyMapError') || err.message.includes('ApiNotActivatedMapError')) {
            errorMessage += 'API key is invalid or the required APIs are not enabled. ';
            errorMessage += 'Please enable "Maps JavaScript API" in Google Cloud Console.';
          } else if (err.message.includes('RefererNotAllowedMapError')) {
            errorMessage += 'API key has referrer restrictions. ';
            errorMessage += 'Add your domain or http://localhost:* to allowed referrers in Google Cloud Console.';
          } else if (err.message.includes('BillingNotEnabledMapError')) {
            errorMessage += 'Billing is not enabled for your Google Cloud project. Enable it in Google Cloud Console.';
          } else {
            errorMessage += err.message;
          }
        } else {
          errorMessage += 'Check your API key, internet connection, and billing.';
        }

        if (!cancelled) {
          setError(errorMessage);
          setLoading(false);
        }
      }
    };

    initMap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // If we're still loading after 12s, show a hint and "Stop & retry" so user isn't stuck
  useEffect(() => {
    if (!loading || error) return;
    const t = setTimeout(() => setShowSlowLoadHint(true), 12000);
    return () => clearTimeout(t);
  }, [loading, error]);

  const handleStopAndRetry = () => {
    setShowSlowLoadHint(false);
    setError(
      'The map took too long to load. Check: (1) Maps JavaScript API is enabled, (2) Billing is on for your Google Cloud project, (3) Under Keys, your API key has Application restrictions that allow this site (e.g. http://localhost:*). Then click Retry.'
    );
    setLoading(false);
  };

  // Update markers when trip activities change
  useEffect(() => {
    if (!map || !trip) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    // Get all activities
    const allActivities = trip.days.flatMap(day => day.activities);

    // Create markers for each activity
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

      // Add click listener to show info window
      marker.addListener('click', () => {
        setSelectedActivity(activity);
        setShowAddForm(false);
      });

      markersRef.current.set(activity.id, marker);
    });

    // Fit map to show all markers if there are any
    if (allActivities.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allActivities.forEach(activity => {
        bounds.extend(activity.coordinates);
      });
      map.fitBounds(bounds);
    }
  }, [map, trip]);

  // Draw routes between activities in each day
  useEffect(() => {
    if (!map || !trip) return;

    // Clear existing polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    // Color palette for different days
    const dayColors = [
      '#ef4444', // red
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
    ];

    // Draw routes for each day
    trip.days.forEach((day, index) => {
      if (day.activities.length < 2) return; // Need at least 2 points for a route

      const path = day.activities.map(activity => activity.coordinates);
      const color = dayColors[index % dayColors.length];

      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: color,
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
              setError(null);
              setShowSlowLoadHint(false);
              setLoading(true);
              setRetryKey((k) => k + 1);
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
          {showSlowLoadHint && (
            <div className="mt-6 max-w-sm mx-auto">
              <p className="text-sm text-gray-600 mb-3">
                Taking a while? The map may not load if API key restrictions or billing aren’t set up.
              </p>
              <button
                type="button"
                onClick={handleStopAndRetry}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Stop & show retry
              </button>
            </div>
          )}
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
