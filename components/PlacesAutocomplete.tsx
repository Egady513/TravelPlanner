'use client';

import { useEffect, useRef } from 'react';

interface PlaceResult {
  name: string;
  coordinates: { lat: number; lng: number };
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (result: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  locationBias?: { lat: number; lng: number };
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Search for a place...',
  className = '',
  locationBias,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    if (!window.google?.maps?.places) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['name', 'geometry', 'formatted_address'],
    });

    if (locationBias) {
      const delta = 2; // ~2 degree radius (~140mi) soft bias
      autocompleteRef.current.setBounds(
        new window.google.maps.LatLngBounds(
          { lat: locationBias.lat - delta, lng: locationBias.lng - delta },
          { lat: locationBias.lat + delta, lng: locationBias.lng + delta }
        )
      );
    }

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place?.geometry?.location) return;

      const name = place.name || place.formatted_address || '';
      const coordinates = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };

      onChange(name);
      onPlaceSelected({ name, coordinates });
    });

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply bounds if locationBias changes after mount
  useEffect(() => {
    if (!autocompleteRef.current || !locationBias) return;
    const delta = 2;
    autocompleteRef.current.setBounds(
      new window.google.maps.LatLngBounds(
        { lat: locationBias.lat - delta, lng: locationBias.lng - delta },
        { lat: locationBias.lat + delta, lng: locationBias.lng + delta }
      )
    );
  }, [locationBias]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
