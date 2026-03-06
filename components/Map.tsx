'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTrip } from '@/lib/store';
import { Activity, Coordinates, ActivityType, DrivingActivity } from '@/types';
import { DirectionsQueue } from '@/lib/directionsQueue';
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
  activity: '#8b5cf6', // purple
  scenic: '#06b6d4',   // cyan
};

const ALL_TYPES = Object.keys(markerColors) as ActivityType[];

const activityEmojis: Record<ActivityType, string> = {
  trail: '🥾',
  hotel: '🏨',
  restaurant: '🍽️',
  camping: '⛺',
  park: '🏞️',
  driving: '🚗',
  activity: '🎡',
  scenic: '🌄',
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
  const [visibleTypes, setVisibleTypes] = useState<Set<ActivityType>>(
    () => new Set<ActivityType>(['trail', 'hotel', 'restaurant', 'camping', 'park', 'driving', 'activity', 'scenic'])
  );

  // Day selector state — empty array means "All Days"
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Legend/filter panel collapsed state
  const [legendOpen, setLegendOpen] = useState(true);

  // Lodging group checkbox ref (for indeterminate state)
  const lodgingCheckboxRef = useRef<HTMLInputElement>(null);

  // Markers
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  // Dashed polylines for driving activity start→end segments
  const drivingPolylinesRef = useRef<google.maps.Polyline[]>([]);

  // Dotted connector lines from each drive's endLocation to the next non-driving activity
  const activityConnectorsRef = useRef<Map<string, google.maps.Polyline>>(new Map());

  // Real-road route renderers (replace straight-line polylinesRef)
  const directionsRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  // Manual polylines for day routes (replaces DirectionsRenderer to enable hover events)
  const dayRoutePolylinesRef = useRef<google.maps.Polyline[]>([]);
  // Cache keyed by "lat,lng|lat,lng|..." to avoid duplicate API calls
  const directionsCache = useRef<Map<string, google.maps.DirectionsResult>>(new Map());
  // Track route keys that have failed so we don't retry them on every re-render
  const failedRouteCacheRef = useRef<Set<string>>(new Set());

  // Shared DirectionsService request queue (serialized, rate-limit safe)
  const directionsQueueRef = useRef<DirectionsQueue>(new DirectionsQueue());
  // Track driving route segments that permanently failed (ZERO_RESULTS)
  const failedSegmentsRef = useRef<Set<string>>(new Set());
  // Per-segment distance/time labels (extracted from DirectionsResult)
  const segmentInfoCache = useRef<Map<string, string>>(new Map());

  // Drive time cache and InfoWindow for hover tooltips
  const driveTimeCache = useRef<Map<string, string>>(new Map());
  const driveTimeInfoWindow = useRef<google.maps.InfoWindow | null>(null);

  const { trip, selectedDay } = useTrip();

  // Helper: is a given day number currently selected?
  const isDaySelected = (dayNum: number) =>
    selectedDays.length === 0 || selectedDays.includes(dayNum);

  // Helper: format "Day 6 · Sun, Jun 7" from a day number
  const formatDayLabel = useCallback((dayNumber: number): string => {
    const day = trip?.days.find(d => d.dayNumber === dayNumber);
    if (day?.date) {
      const d = new Date(day.date);
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `Day ${dayNumber} · ${weekday}, ${monthDay}`;
    }
    return `Day ${dayNumber}`;
  }, [trip]);

  // Helper: show a drive time InfoWindow at a given position
  const showDriveTimeTooltip = useCallback((position: google.maps.LatLng | null, label: string) => {
    if (!map || !position) return;

    if (!driveTimeInfoWindow.current) {
      driveTimeInfoWindow.current = new google.maps.InfoWindow();
    }

    driveTimeInfoWindow.current.setContent(
      `<div style="font-size:12px;padding:3px 7px;line-height:1.4;white-space:nowrap;font-family:inherit">${label}</div>`
    );
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
          mapId: 'DEMO_MAP_ID',  // required for AdvancedMarkerElement
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
    markersRef.current.forEach(marker => { marker.map = null; });
    markersRef.current.clear();

    const allActivities = trip.days.flatMap(day => day.activities ?? []).filter(a => {
      if (a.showOnMap === false) return false;
      if (!isDaySelected(a.dayNumber)) return false;
      return visibleTypes.has(a.type);
    });

    allActivities.forEach(activity => {
      const el = document.createElement('div');
      el.style.cssText = [
        'width:34px', 'height:34px',
        `background:${markerColors[activity.type]}`,
        'border-radius:50%',
        'border:2px solid white',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:17px',
        'box-shadow:0 2px 6px rgba(0,0,0,0.35)',
        'cursor:pointer',
      ].join(';');
      el.textContent = activityEmojis[activity.type] ?? '📍';

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: activity.coordinates,
        map,
        title: activity.name,
        content: el,
      });

      marker.addListener('click', () => {
        setSelectedActivity(activity);
        setShowAddForm(false);
      });

      markersRef.current.set(activity.id, marker);
    });

    // Add waypoint pins for driving activities (always visible, regardless of layer toggle)
    trip.days.forEach(day => {
      if (!isDaySelected(day.dayNumber)) return;
      (day.activities ?? []).forEach(activity => {
        if (activity.type !== 'driving') return;
        const drive = activity as DrivingActivity;
        if (!drive.waypoints?.length) return;
        drive.waypoints.forEach((wp, i) => {
          const wpEl = document.createElement('div');
          wpEl.style.cssText = [
            'width:10px',
            'height:10px',
            'border-radius:50%',
            'background:#6b7280',
            'border:2px solid white',
          ].join(';');

          const wpMarker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: wp.coordinates.lat, lng: wp.coordinates.lng },
            map,
            title: wp.name,
            content: wpEl,
          });

          markersRef.current.set(`wp-${drive.id}-${i}`, wpMarker);
        });
      });
    });

    // Fit map to show all visible markers
    if (allActivities.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allActivities.forEach(activity => bounds.extend(activity.coordinates));
      map.fitBounds(bounds);
    }
  }, [map, trip, visibleTypes, selectedDays]);

  // Draw real-road routes between activities in each day (via shared queue)
  // Only draw when viewing "All Days" or multiple days — single-day view uses
  // driving routes + activity connectors instead, cutting API calls ~50%.
  useEffect(() => {
    if (!map || !trip) return;

    // Clear previous day route polylines
    dayRoutePolylinesRef.current.forEach(p => p.setMap(null));
    dayRoutePolylinesRef.current = [];
    // Clear previous renderers (legacy cleanup)
    directionsRenderersRef.current.forEach(r => r.setMap(null));
    directionsRenderersRef.current = [];
    // Clear failed route cache so routes can be retried if trip data changes
    failedRouteCacheRef.current.clear();

    // Skip day routes when a single day is selected (driving routes + connectors suffice)
    const shouldDrawDayRoutes = selectedDays.length === 0 || selectedDays.length > 1;
    if (!shouldDrawDayRoutes) return;

    const dayColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

    trip.days.forEach((day, index) => {
      if (!isDaySelected(day.dayNumber)) return;

      const visibleActivities = (day.activities ?? []).filter(a =>
        a.showOnMap !== false &&
        a.coordinates?.lat !== 0 &&
        a.coordinates?.lng !== 0
      );
      if (visibleActivities.length < 2) return;

      const waypoints = visibleActivities.slice(1, -1).map(a => ({
        location: new google.maps.LatLng(a.coordinates.lat, a.coordinates.lng),
        stopover: false,
      }));

      const origin = new google.maps.LatLng(
        visibleActivities[0].coordinates.lat,
        visibleActivities[0].coordinates.lng
      );
      const destination = new google.maps.LatLng(
        visibleActivities[visibleActivities.length - 1].coordinates.lat,
        visibleActivities[visibleActivities.length - 1].coordinates.lng
      );

      const cacheKey = visibleActivities.map(a => `${a.coordinates.lat},${a.coordinates.lng}`).join('|');
      const color = dayColors[index % dayColors.length];
      const startName = visibleActivities[0].name;
      const endName = visibleActivities[visibleActivities.length - 1].name;

      const drawDayRoute = (result: google.maps.DirectionsResult) => {
        const path = result.routes[0]?.overview_path;
        if (!path) return;

        // Calculate total drive time across all legs
        const legs = result.routes[0]?.legs ?? [];
        const totalSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);
        const totalDistance = legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
        const distMi = (totalDistance * 0.000621371).toFixed(0);
        const dayLabel = formatDayLabel(day.dayNumber);
        const activityLines = (day.activities ?? [])
          .filter(a => a.showOnMap !== false)
          .map(a => `${activityEmojis[a.type as ActivityType] ?? '📍'} ${a.name}`)
          .join('<br/>');
        const hoverLabel = `🚗 ${timeStr} · ${distMi} mi<br/><span style="font-size:11px;color:#6b7280">${dayLabel}: ${startName} → ${endName}</span>${activityLines ? `<br/><div style="margin-top:4px;font-size:11px;color:#374151;line-height:1.6">${activityLines}</div>` : ''}`;

        // Dashed visible polyline (day color)
        const dashedLine = new google.maps.Polyline({
          path,
          geodesic: false,
          strokeColor: color,
          strokeOpacity: 0,
          strokeWeight: 0,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.65, scale: 2.5, strokeColor: color },
            offset: '0',
            repeat: '14px',
          }],
          map,
          zIndex: 1,
        });
        dayRoutePolylinesRef.current.push(dashedLine);

        // Invisible hit-area polyline for hover events
        const hitArea = new google.maps.Polyline({
          path,
          strokeColor: color,
          strokeOpacity: 0,
          strokeWeight: 12,
          map,
          zIndex: 2,
        });
        dayRoutePolylinesRef.current.push(hitArea);

        hitArea.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
          showDriveTimeTooltip(e.latLng, hoverLabel);
        });
        hitArea.addListener('mouseout', () => {
          driveTimeInfoWindow.current?.close();
        });
      };

      if (directionsCache.current.has(cacheKey)) {
        drawDayRoute(directionsCache.current.get(cacheKey)!);
        return;
      }
      if (failedRouteCacheRef.current.has(cacheKey)) return;

      // Use shared queue instead of direct DirectionsService call
      directionsQueueRef.current.enqueue({
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      }).then(result => {
        directionsCache.current.set(cacheKey, result);
        drawDayRoute(result);
      }).catch(status => {
        if (String(status) === 'ZERO_RESULTS') {
          failedRouteCacheRef.current.add(cacheKey);
        }
        console.warn(`[DayRoute] Failed day ${day.dayNumber}: ${status}`);
      });
    });
  }, [map, trip, visibleTypes, selectedDays, showDriveTimeTooltip, formatDayLabel]);

  // Dashed polylines for driving activity start→end (per-segment via queue)
  useEffect(() => {
    if (!map || !trip) return;

    drivingPolylinesRef.current.forEach(p => p.setMap(null));
    drivingPolylinesRef.current = [];

    // Cancel any pending queue requests from previous render
    directionsQueueRef.current.clear();
    // Clear failed segments so routes can be retried if trip data changed
    failedSegmentsRef.current.clear();

    if (!visibleTypes.has('driving')) return;

    const allActivities = trip.days
      .flatMap(d => d.activities ?? [])
      .filter(a => a.showOnMap !== false && a.type === 'driving' && isDaySelected(a.dayNumber));

    const drivingActivities = allActivities as DrivingActivity[];

    drivingActivities.forEach((drive) => {
      // Skip routes with invalid coordinates (geocoding failed)
      const startCoords = drive.startLocation.coordinates;
      const endCoords = drive.endLocation.coordinates;
      if (!startCoords || (startCoords.lat === 0 && startCoords.lng === 0) ||
          !endCoords || (endCoords.lat === 0 && endCoords.lng === 0)) {
        console.warn(`[Map] Skipping route for drive "${drive.name}" — missing coordinates`);
        return;
      }

      const validWaypoints = (drive.waypoints ?? []).filter(
        w => w.coordinates && (w.coordinates.lat !== 0 || w.coordinates.lng !== 0)
      );

      // Build the full stops array: start, ...waypoints, end
      const stops: { lat: number; lng: number; name: string }[] = [
        { lat: startCoords.lat, lng: startCoords.lng, name: drive.startLocation.name },
        ...validWaypoints.map(w => ({ lat: w.coordinates.lat, lng: w.coordinates.lng, name: w.name })),
        { lat: endCoords.lat, lng: endCoords.lng, name: drive.endLocation.name },
      ];

      const attachSegmentHover = (polyline: google.maps.Polyline, segCacheKey: string) => {
        polyline.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
          // Use per-segment distance/time from DirectionsResult (cached)
          if (segmentInfoCache.current.has(segCacheKey)) {
            showDriveTimeTooltip(e.latLng, segmentInfoCache.current.get(segCacheKey)!);
          }
        });
        polyline.addListener('mouseout', () => {
          driveTimeInfoWindow.current?.close();
        });
      };

      const makeDashedPolyline = (path: google.maps.LatLng[] | google.maps.MVCArray<google.maps.LatLng>, segCacheKey: string) => {
        // White halo underneath — gives the "nav app" premium feel
        const halo = new google.maps.Polyline({
          path,
          geodesic: false,
          strokeColor: '#ffffff',
          strokeOpacity: 0.9,
          strokeWeight: 9,
          map,
          zIndex: 1,
        });
        drivingPolylinesRef.current.push(halo);

        // Solid orange driving route on top — the spine of the trip
        const polyline = new google.maps.Polyline({
          path,
          geodesic: false,
          strokeColor: '#ea580c',
          strokeOpacity: 1,
          strokeWeight: 5,
          map,
          zIndex: 2,
        });
        drivingPolylinesRef.current.push(polyline);
        attachSegmentHover(polyline, segCacheKey);
      };

      // Iterate over consecutive pairs of stops — one DirectionsService call per pair via queue
      for (let i = 0; i < stops.length - 1; i++) {
        const segFrom = stops[i];
        const segTo = stops[i + 1];
        const segCacheKey = `seg|${segFrom.lat},${segFrom.lng}|${segTo.lat},${segTo.lng}`;

        // Use directions cache if available
        if (directionsCache.current.has(segCacheKey)) {
          // Backfill hover label if missing (e.g. after re-render)
          if (!segmentInfoCache.current.has(segCacheKey)) {
            const cached = directionsCache.current.get(segCacheKey)!;
            const leg = cached.routes[0]?.legs[0];
            if (leg?.distance && leg?.duration) {
              const drvDayLabel = formatDayLabel(drive.dayNumber);
              segmentInfoCache.current.set(segCacheKey, `🚗 ${leg.duration.text} · ${leg.distance.text}<br/><span style="font-size:11px;color:#6b7280">${drvDayLabel}: ${segFrom.name} → ${segTo.name}</span>`);
            }
          }
          makeDashedPolyline(directionsCache.current.get(segCacheKey)!.routes[0].overview_path, segCacheKey);
          continue;
        }

        // Skip permanently failed segments (draw straight-line fallback)
        if (failedSegmentsRef.current.has(segCacheKey)) {
          makeDashedPolyline([
            new google.maps.LatLng(segFrom.lat, segFrom.lng),
            new google.maps.LatLng(segTo.lat, segTo.lng),
          ], segCacheKey);
          continue;
        }

        // Enqueue via shared queue (serialized, rate-limit safe)
        const capturedFrom = segFrom;
        const capturedTo = segTo;
        const capturedKey = segCacheKey;

        directionsQueueRef.current.enqueue({
          origin: new google.maps.LatLng(capturedFrom.lat, capturedFrom.lng),
          destination: new google.maps.LatLng(capturedTo.lat, capturedTo.lng),
          travelMode: google.maps.TravelMode.DRIVING,
        }).then(result => {
          directionsCache.current.set(capturedKey, result);

          // Extract per-segment distance/time from DirectionsResult
          const leg = result.routes[0]?.legs[0];
          if (leg?.distance && leg?.duration) {
            const drvDayLabel = formatDayLabel(drive.dayNumber);
            const label = `🚗 ${leg.duration.text} · ${leg.distance.text}<br/><span style="font-size:11px;color:#6b7280">${drvDayLabel}: ${capturedFrom.name} → ${capturedTo.name}</span>`;
            segmentInfoCache.current.set(capturedKey, label);
          }

          makeDashedPolyline(result.routes[0].overview_path, capturedKey);
        }).catch(status => {
          if (status === 'ZERO_RESULTS') {
            // Genuine no-route: mark as permanently failed and draw straight-line fallback
            console.warn(`[DrivingRoute] No route: ${capturedFrom.name} → ${capturedTo.name}`);
            failedSegmentsRef.current.add(capturedKey);
            const fallbackDayLabel = formatDayLabel(drive.dayNumber);
            const fallbackLabel = `⚠️ No route found<br/><span style="font-size:11px;color:#6b7280">${fallbackDayLabel}: ${capturedFrom.name} → ${capturedTo.name}</span>`;
            segmentInfoCache.current.set(capturedKey, fallbackLabel);
            makeDashedPolyline([
              new google.maps.LatLng(capturedFrom.lat, capturedFrom.lng),
              new google.maps.LatLng(capturedTo.lat, capturedTo.lng),
            ], capturedKey);
          } else {
            // Transient error after retries — do NOT draw straight line; will retry on next render
            console.error(`[DrivingRoute] Failed after retries: ${capturedFrom.name} → ${capturedTo.name} (${status})`);
          }
        });
      }
    });
  }, [map, trip, visibleTypes, selectedDays, showDriveTimeTooltip, formatDayLabel]);

  // Dotted connector lines between consecutive activities within each day.
  // Connects: drive.endLocation → next activity, AND consecutive non-driving activities
  // (e.g. hotel → rodeo → dinner). Each connector has a hover tooltip showing distance/time.
  useEffect(() => {
    if (!map) return;

    // Clear all existing connectors
    activityConnectorsRef.current.forEach(p => p.setMap(null));
    activityConnectorsRef.current.clear();

    if (!trip) return;

    trip.days.forEach(day => {
      if (!isDaySelected(day.dayNumber)) return;

      const dayActivities = (day.activities ?? []).filter(a =>
        a.showOnMap !== false &&
        a.coordinates?.lat !== 0 &&
        a.coordinates?.lng !== 0
      );

      // Build an ordered chain of connection points.
      // For driving activities, use endLocation (start→end is handled by the driving route polylines).
      // For non-driving activities, use the activity's coordinates.
      interface ConnPoint {
        id: string;
        coords: Coordinates;
        name: string;
      }
      const points: ConnPoint[] = [];

      dayActivities.forEach(activity => {
        if (activity.type === 'driving') {
          const drive = activity as DrivingActivity;
          const endCoords = drive.endLocation?.coordinates;
          if (endCoords && (endCoords.lat !== 0 || endCoords.lng !== 0)) {
            points.push({
              id: `${drive.id}-end`,
              coords: endCoords,
              name: drive.endLocation.name,
            });
          }
        } else {
          points.push({
            id: activity.id,
            coords: activity.coordinates,
            name: activity.name,
          });
        }
      });

      // Draw dotted connectors between consecutive points
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i];
        const to = points[i + 1];
        const connectorKey = `connector-${day.dayNumber}-${from.id}-${to.id}`;

        // Dotted gray connector line
        const connector = new google.maps.Polyline({
          path: [
            { lat: from.coords.lat, lng: from.coords.lng },
            { lat: to.coords.lat, lng: to.coords.lng },
          ],
          geodesic: true,
          strokeColor: '#9ca3af',
          strokeOpacity: 0,
          strokeWeight: 2,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, scale: 3 },
            offset: '0',
            repeat: '12px',
          }],
          map,
        });
        activityConnectorsRef.current.set(connectorKey, connector);

        // Invisible hit-area polyline for hover (wider for easy targeting)
        const hitArea = new google.maps.Polyline({
          path: [
            { lat: from.coords.lat, lng: from.coords.lng },
            { lat: to.coords.lat, lng: to.coords.lng },
          ],
          strokeColor: '#9ca3af',
          strokeOpacity: 0,
          strokeWeight: 14,
          map,
          zIndex: 3,
        });
        activityConnectorsRef.current.set(`${connectorKey}-hit`, hitArea);

        // Hover tooltip: lazy fetch distance/time via DistanceMatrixService (cached)
        const distCacheKey = `dist|${from.coords.lat},${from.coords.lng}|${to.coords.lat},${to.coords.lng}`;
        const capturedFrom = from;
        const capturedTo = to;

        hitArea.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
          if (driveTimeCache.current.has(distCacheKey)) {
            showDriveTimeTooltip(e.latLng, driveTimeCache.current.get(distCacheKey)!);
            return;
          }
          const service = new google.maps.DistanceMatrixService();
          service.getDistanceMatrix({
            origins: [{ lat: capturedFrom.coords.lat, lng: capturedFrom.coords.lng }],
            destinations: [{ lat: capturedTo.coords.lat, lng: capturedTo.coords.lng }],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.IMPERIAL,
          }, (result, status) => {
            if (status === 'OK' && result) {
              const element = result.rows[0]?.elements[0];
              if (element?.status === 'OK') {
                const connDayLabel = formatDayLabel(day.dayNumber);
                const label = `🚗 ${element.duration?.text} · ${element.distance?.text}<br/><span style="font-size:11px;color:#6b7280">${connDayLabel}: ${capturedFrom.name} → ${capturedTo.name}</span>`;
                driveTimeCache.current.set(distCacheKey, label);
                showDriveTimeTooltip(e.latLng, label);
              }
            }
          });
        });
        hitArea.addListener('mouseout', () => {
          driveTimeInfoWindow.current?.close();
        });
      }
    });
  }, [map, trip, selectedDays, showDriveTimeTooltip, formatDayLabel]);

  // Sync lodging group checkbox indeterminate state
  useEffect(() => {
    if (lodgingCheckboxRef.current) {
      lodgingCheckboxRef.current.indeterminate =
        visibleTypes.has('hotel') !== visibleTypes.has('camping');
    }
  }, [visibleTypes]);

  // Fit map to selected day's activities when selectedDay changes
  useEffect(() => {
    if (!map || !trip || !selectedDay) return;
    const day = trip.days.find(d => d.dayNumber === selectedDay);
    if (!day) return;
    const acts = day.activities ?? [];
    if (acts.length === 0) return;

    if (acts.length === 1) {
      map.panTo(acts[0].coordinates);
      map.setZoom(12);
    } else {
      const bounds = new google.maps.LatLngBounds();
      acts.forEach(a => bounds.extend(a.coordinates));
      map.fitBounds(bounds, 80);
    }
  }, [selectedDay, map, trip]);

  return (
    <>
      {/* Map wrapper: relative so the filter overlay can be positioned absolutely inside it */}
      <div className={`${className} relative`} style={{ visibility: (loading || error) ? 'hidden' : 'visible' }}>
        <div ref={mapRef} style={{ height: '100%' }} />

        {/* Filter overlay panel — top-right corner, collapsible */}
        {trip && !loading && !error && (
          <div className="absolute top-2 right-0 z-10 flex items-start">
            {/* Toggle tab — always visible on the left edge of the panel */}
            <button
              onClick={() => setLegendOpen(o => !o)}
              className="bg-white rounded-l-lg shadow-md px-1.5 py-3 text-xs text-gray-600 hover:text-gray-900 border border-r-0 border-gray-200 flex flex-col items-center gap-1"
              title={legendOpen ? 'Hide layers' : 'Show layers'}
            >
              <span className="text-gray-500">{legendOpen ? '▶' : '◀'}</span>
              {!legendOpen && (
                <span
                  style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
                  className="text-xs text-gray-400 select-none"
                >
                  Layers
                </span>
              )}
            </button>

            {/* Panel — slides in/out via width + opacity transition */}
            <div
              className={`bg-white rounded-l-lg shadow-md text-sm overflow-hidden transition-all duration-300 ${
                legendOpen ? 'w-44 opacity-100 p-3' : 'w-0 opacity-0 p-0'
              }`}
            >
              {legendOpen && (
                <>
                  <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Layers</p>

                  <div className="flex gap-1 mb-2">
                    <button
                      onClick={() => setVisibleTypes(new Set(ALL_TYPES))}
                      className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setVisibleTypes(new Set<ActivityType>())}
                      className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      None
                    </button>
                  </div>

                  {(
                    [
                      { type: 'trail' as ActivityType, label: 'Trail', emoji: '🥾' },
                      { type: 'restaurant' as ActivityType, label: 'Restaurant', emoji: '🍽️' },
                      { type: 'park' as ActivityType, label: 'Park', emoji: '🏞️' },
                      { type: 'driving' as ActivityType, label: 'Driving', emoji: '🚗' },
                      { type: 'activity' as ActivityType, label: 'Activity', emoji: '🎡' },
                      { type: 'scenic' as ActivityType, label: 'Scenic Drive', emoji: '🌄' },
                    ]
                  ).map(({ type, label, emoji }) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer mb-1">
                      <input
                        type="checkbox"
                        checked={visibleTypes.has(type)}
                        onChange={e => {
                          setVisibleTypes(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) { next.add(type); } else { next.delete(type); }
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm">{emoji} {label}</span>
                    </label>
                  ))}

                  {/* Lodging group toggle */}
                  <label className="flex items-center gap-2 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={visibleTypes.has('hotel') || visibleTypes.has('camping')}
                      ref={lodgingCheckboxRef}
                      onChange={e => {
                        setVisibleTypes(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) { next.add('hotel'); next.add('camping'); }
                          else { next.delete('hotel'); next.delete('camping'); }
                          return next;
                        });
                      }}
                    />
                    <span className="text-sm">🏠 Lodging</span>
                  </label>
                  {/* Individual hotel/camping sub-checkboxes */}
                  <div className="ml-4">
                    {([{ type: 'hotel' as ActivityType, label: 'Hotel', emoji: '🏨' }, { type: 'camping' as ActivityType, label: 'Camping', emoji: '⛺' }]).map(({ type, label, emoji }) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer mb-1">
                        <input
                          type="checkbox"
                          checked={visibleTypes.has(type)}
                          onChange={e => {
                            setVisibleTypes(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) { next.add(type); } else { next.delete(type); }
                              return next;
                            });
                          }}
                        />
                        <span className="text-xs text-gray-600">{emoji} {label}</span>
                      </label>
                    ))}
                  </div>

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
                </>
              )}
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
