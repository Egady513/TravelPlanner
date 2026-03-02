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

  // Real-road route renderers (replace straight-line polylinesRef)
  const directionsRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  // Manual polylines for day routes (replaces DirectionsRenderer to enable hover events)
  const dayRoutePolylinesRef = useRef<google.maps.Polyline[]>([]);
  // Cache keyed by "lat,lng|lat,lng|..." to avoid duplicate API calls
  const directionsCache = useRef<Map<string, google.maps.DirectionsResult>>(new Map());

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

    const allActivities = trip.days.flatMap(day => day.activities).filter(a => {
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

    // Fit map to show all visible markers
    if (allActivities.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allActivities.forEach(activity => bounds.extend(activity.coordinates));
      map.fitBounds(bounds);
    }
  }, [map, trip, visibleTypes, selectedDays]);

  // Draw real-road routes between activities in each day
  useEffect(() => {
    if (!map || !trip) return;

    // Clear previous day route polylines
    dayRoutePolylinesRef.current.forEach(p => p.setMap(null));
    dayRoutePolylinesRef.current = [];
    // Clear previous renderers (legacy cleanup)
    directionsRenderersRef.current.forEach(r => r.setMap(null));
    directionsRenderersRef.current = [];

    const dayColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

    trip.days.forEach((day, index) => {
      if (!isDaySelected(day.dayNumber)) return;

      const visibleActivities = day.activities.filter(a => a.showOnMap !== false);
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
        const hoverLabel = `🚗 ${timeStr} · ${distMi} mi<br/><span style="font-size:11px;color:#6b7280">Day ${day.dayNumber}: ${startName} → ${endName}</span>`;

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

      const service = new google.maps.DirectionsService();
      service.route(
        {
          origin,
          destination,
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        },
        (result, status) => {
          if (status === 'OK' && result) {
            directionsCache.current.set(cacheKey, result);
            drawDayRoute(result);
          } else {
            console.error(`[DirectionsService] status=${status} for day ${day.dayNumber}.`);
          }
        }
      );
    });
  }, [map, trip, visibleTypes, selectedDays, showDriveTimeTooltip]);

  // Dashed polylines for driving activity start→end
  useEffect(() => {
    if (!map || !trip) return;

    drivingPolylinesRef.current.forEach(p => p.setMap(null));
    drivingPolylinesRef.current = [];

    if (!visibleTypes.has('driving')) return;

    const allActivities = trip.days
      .flatMap(d => d.activities)
      .filter(a => a.showOnMap !== false && a.type === 'driving' && isDaySelected(a.dayNumber));

    const drivingActivities = allActivities as DrivingActivity[];

    drivingActivities.forEach(drive => {
      const cacheKey = `drive|${drive.startLocation.coordinates.lat},${drive.startLocation.coordinates.lng}→${drive.endLocation.coordinates.lat},${drive.endLocation.coordinates.lng}`;

      const attachHover = (polyline: google.maps.Polyline) => {
        polyline.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
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
                const label = `🚗 ${element.duration?.text} · ${element.distance?.text}<br/><span style="font-size:11px;color:#6b7280">${drive.startLocation.name} → ${drive.endLocation.name}</span>`;
                driveTimeCache.current.set(cacheKey, label);
                showDriveTimeTooltip(e.latLng, label);
              }
            }
          });
        });
        polyline.addListener('mouseout', () => {
          driveTimeInfoWindow.current?.close();
        });
      };

      const makeDashedPolyline = (path: google.maps.LatLng[] | google.maps.MVCArray<google.maps.LatLng>) => {
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
        attachHover(polyline);
      };

      // Use cached route if available
      if (directionsCache.current.has(cacheKey)) {
        makeDashedPolyline(directionsCache.current.get(cacheKey)!.routes[0].overview_path);
      } else {
        // Fetch real road path, fall back to straight line on failure
        const dirService = new google.maps.DirectionsService();
        dirService.route(
          {
            origin: drive.startLocation.coordinates,
            destination: drive.endLocation.coordinates,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === 'OK' && result) {
              directionsCache.current.set(cacheKey, result);
              makeDashedPolyline(result.routes[0].overview_path);
            } else {
              // Fallback: straight dashed line
              makeDashedPolyline([
                new google.maps.LatLng(drive.startLocation.coordinates.lat, drive.startLocation.coordinates.lng),
                new google.maps.LatLng(drive.endLocation.coordinates.lat, drive.endLocation.coordinates.lng),
              ]);
            }
          }
        );
      }
    });
  }, [map, trip, visibleTypes, selectedDays, showDriveTimeTooltip]);

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
