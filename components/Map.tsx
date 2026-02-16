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
    const initMap = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
          setError('Google Maps API key is missing. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.');
          setLoading(false);
          return;
        }

        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry', 'marker']
        });

        const { Map } = await loader.importLibrary('maps') as any;

        if (mapRef.current) {
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

          setMap(mapInstance);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading Google Maps:', err);
        setError('Failed to load Google Maps. Please check your API key and internet connection.');
        setLoading(false);
      }
    };

    initMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="text-center p-8">
          <p className="text-red-600 font-semibold mb-2">Map Error</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`}>
        <div className="text-center">
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
