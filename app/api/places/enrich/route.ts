import type { NextRequest } from 'next/server';

interface RawSuggestion {
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

interface EnrichedSuggestion extends RawSuggestion {
  photoUrl: string | null;
  rating: number | null;
  googlePlaceId: string | null;
}

interface PlacesTextSearchResult {
  place_id?: string;
  rating?: number;
  photos?: Array<{ photo_reference: string }>;
}

interface PlacesTextSearchResponse {
  results?: PlacesTextSearchResult[];
  status?: string;
}

async function enrichOne(s: RawSuggestion, apiKey: string): Promise<EnrichedSuggestion> {
  try {
    const query = encodeURIComponent(`${s.name} ${s.location}`);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );
    const data = await res.json() as PlacesTextSearchResponse;
    const place = data.results?.[0];
    if (!place) return { ...s, photoUrl: null, rating: null, googlePlaceId: null };

    const photoRef = place.photos?.[0]?.photo_reference ?? null;
    const photoUrl = photoRef
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${photoRef}&key=${apiKey}`
      : null;

    return {
      ...s,
      photoUrl,
      rating: place.rating ?? null,
      googlePlaceId: place.place_id ?? null,
    };
  } catch {
    return { ...s, photoUrl: null, rating: null, googlePlaceId: null };
  }
}

export async function POST(request: NextRequest) {
  let suggestions: RawSuggestion[];
  try {
    const body = await request.json() as { suggestions: RawSuggestion[] };
    suggestions = body.suggestions;
    if (!Array.isArray(suggestions)) throw new Error('suggestions must be an array');
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Gracefully degrade: return suggestions without enrichment
    const bare: EnrichedSuggestion[] = suggestions.map(s => ({
      ...s, photoUrl: null, rating: null, googlePlaceId: null,
    }));
    return Response.json({ enriched: bare });
  }

  const enriched = await Promise.all(suggestions.map(s => enrichOne(s, apiKey)));
  return Response.json({ enriched });
}
