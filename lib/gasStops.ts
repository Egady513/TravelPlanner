import { Coordinates, DrivingActivity } from '@/types';

export interface GasStopPoint {
  coordinates: Coordinates;
  legLabel: string;        // e.g. "Day 3: Jackson → Salt Lake City"
  milesFromStart: number;
  isLimitedGasArea: boolean;
  resolvedStation?: {
    name: string;
    coordinates: Coordinates;
    rating?: number;
    vicinity?: string;
    placeId?: string;
  };
}

// Haversine distance between two lat/lng points in miles
function haversineDistanceMiles(a: Coordinates, b: Coordinates): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// Walk a polyline path and collect coordinates at regular distance intervals (in miles).
// Returns an array of { coordinates, cumulativeMiles } objects.
function samplePathAtDistances(
  path: google.maps.LatLng[],
  sampleDistances: number[]  // sorted ascending
): Array<{ coordinates: Coordinates; milesFromStart: number }> {
  if (path.length < 2 || sampleDistances.length === 0) return [];

  const results: Array<{ coordinates: Coordinates; milesFromStart: number }> = [];
  let cumMiles = 0;
  let sampleIdx = 0;

  for (let i = 0; i < path.length - 1 && sampleIdx < sampleDistances.length; i++) {
    const from: Coordinates = { lat: path[i].lat(), lng: path[i].lng() };
    const to: Coordinates = { lat: path[i + 1].lat(), lng: path[i + 1].lng() };
    const segmentMiles = haversineDistanceMiles(from, to);

    while (sampleIdx < sampleDistances.length) {
      const targetMiles = sampleDistances[sampleIdx];
      if (cumMiles + segmentMiles >= targetMiles) {
        // Interpolate along this segment
        const t = (targetMiles - cumMiles) / segmentMiles;
        results.push({
          coordinates: {
            lat: from.lat + t * (to.lat - from.lat),
            lng: from.lng + t * (to.lng - from.lng),
          },
          milesFromStart: targetMiles,
        });
        sampleIdx++;
      } else {
        break;
      }
    }

    cumMiles += segmentMiles;
  }

  return results;
}

/**
 * Calculate gas stop points along a set of driving activities.
 *
 * For each driving activity that has a resolved DirectionsResult, walks the
 * polyline and flags refuel points at (vehicleRangeMiles - 50) mile intervals,
 * assuming a full tank at the start of each leg.
 *
 * The isLimitedGasArea flag is initially false — it gets set by the gas station
 * lookup in useGasStations.ts after querying Google Places.
 */
export function calculateGasStops(
  drivingActivities: DrivingActivity[],
  directionsResults: Map<string, google.maps.DirectionsResult>,
  vehicleRangeMiles: number
): GasStopPoint[] {
  const warningThreshold = vehicleRangeMiles - 50; // warn 50 miles before empty
  const stops: GasStopPoint[] = [];

  for (const drive of drivingActivities) {
    // Build the same cache key used when fetching directions in Map.tsx
    const startCoords = drive.startLocation.coordinates;
    const endCoords = drive.endLocation.coordinates;
    if (!startCoords || !endCoords) continue;

    // Try direct segment key first, then the full-leg key
    const segKey = `seg|${startCoords.lat},${startCoords.lng}|${endCoords.lat},${endCoords.lng}`;

    const result = directionsResults.get(segKey);
    if (!result) continue;

    const route = result.routes[0];
    if (!route?.overview_path?.length) continue;

    const path = route.overview_path;

    // Calculate total leg distance in miles
    const totalLegMiles = route.legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0) * 0.000621371;

    if (totalLegMiles <= warningThreshold) continue; // leg fits in one tank — no stop needed

    // Build the list of distances where we want to sample (every warningThreshold miles along the leg)
    const sampleDistances: number[] = [];
    let d = warningThreshold;
    while (d < totalLegMiles) {
      sampleDistances.push(d);
      d += vehicleRangeMiles;
    }

    const sampled = samplePathAtDistances(path, sampleDistances);

    for (const point of sampled) {
      stops.push({
        coordinates: point.coordinates,
        legLabel: `Day ${drive.dayNumber}: ${drive.startLocation.name} → ${drive.endLocation.name}`,
        milesFromStart: Math.round(point.milesFromStart),
        isLimitedGasArea: false,  // resolved by useGasStations
      });
    }
  }

  return stops;
}
