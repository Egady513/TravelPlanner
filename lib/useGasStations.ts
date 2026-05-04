import { useCallback, useRef, useState } from 'react';
import { GasStopPoint } from './gasStops';
import { Coordinates } from '@/types';

// 15 miles in meters for Places nearbySearch radius
const SEARCH_RADIUS_METERS = 24140;

// A stop with < 2 results within 15 miles is flagged as a limited gas area
const LIMITED_GAS_THRESHOLD = 2;

export interface ResolvedGasStop extends GasStopPoint {
  isLimitedGasArea: boolean;
  resolvedStation?: {
    name: string;
    coordinates: Coordinates;
    rating?: number;
    vicinity?: string;
    placeId?: string;
  };
}

export function useGasStations() {
  const [resolvedStops, setResolvedStops] = useState<ResolvedGasStop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Cache keyed by "lat,lng" string to avoid duplicate API calls
  const cache = useRef<Map<string, ResolvedGasStop>>(new Map());

  const resolveGasStops = useCallback(async (
    stops: GasStopPoint[],
    map: google.maps.Map
  ): Promise<void> => {
    if (stops.length === 0) {
      setResolvedStops([]);
      return;
    }

    setIsLoading(true);

    const resolved: ResolvedGasStop[] = await Promise.all(
      stops.map(stop => {
        const cacheKey = `${stop.coordinates.lat.toFixed(4)},${stop.coordinates.lng.toFixed(4)}`;

        if (cache.current.has(cacheKey)) {
          return Promise.resolve(cache.current.get(cacheKey)!);
        }

        return new Promise<ResolvedGasStop>(resolve => {
          const service = new google.maps.places.PlacesService(map);
          const location = new google.maps.LatLng(stop.coordinates.lat, stop.coordinates.lng);

          service.nearbySearch(
            {
              location,
              radius: SEARCH_RADIUS_METERS,
              type: 'gas_station',
            },
            (results, status) => {
              let resolvedStop: ResolvedGasStop;

              if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                // Sort by rating descending, fall back to first result
                const sorted = [...results].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
                const best = sorted[0];
                const isLimited = results.length < LIMITED_GAS_THRESHOLD;

                resolvedStop = {
                  ...stop,
                  isLimitedGasArea: isLimited,
                  resolvedStation: {
                    name: best.name ?? 'Gas Station',
                    coordinates: {
                      lat: best.geometry?.location?.lat() ?? stop.coordinates.lat,
                      lng: best.geometry?.location?.lng() ?? stop.coordinates.lng,
                    },
                    rating: best.rating,
                    vicinity: best.vicinity,
                    placeId: best.place_id,
                  },
                };
              } else {
                // No results — this is a limited gas area
                resolvedStop = {
                  ...stop,
                  isLimitedGasArea: true,
                };
              }

              cache.current.set(cacheKey, resolvedStop);
              resolve(resolvedStop);
            }
          );
        });
      })
    );

    setResolvedStops(resolved);
    setIsLoading(false);
  }, []);

  const clearStops = useCallback(() => {
    setResolvedStops([]);
  }, []);

  return { resolvedStops, isLoading, resolveGasStops, clearStops };
}
