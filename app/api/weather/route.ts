import { NextResponse } from 'next/server';
import { WeatherData } from '@/types';

interface PointsResponse {
  properties: { forecast: string };
}

interface ForecastPeriod {
  name: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  probabilityOfPrecipitation: { value: number | null };
  shortForecast: string;
  detailedForecast: string;
  startTime: string;
}

interface ForecastResponse {
  properties: { periods: ForecastPeriod[] };
}

const WEATHER_GOV_HEADERS = {
  'User-Agent': 'TravelPlanner/1.0 (contact@example.com)',
  Accept: 'application/geo+json',
};

function buildWeatherPeriods(periods: ForecastPeriod[]): WeatherData[] {
  const dayMap = new Map<string, { day?: ForecastPeriod; night?: ForecastPeriod }>();
  for (const period of periods) {
    const dateKey = period.startTime.slice(0, 10);
    if (!dayMap.has(dateKey)) { dayMap.set(dateKey, {}); }
    const entry = dayMap.get(dateKey)!;
    if (period.isDaytime) { entry.day = period; } else { entry.night = period; }
  }
  const result: WeatherData[] = [];
  for (const [dateKey, { day, night }] of Array.from(dayMap.entries())) {
    if (!day && !night) continue;
    const primary = day ?? night!;
    const high = day ? day.temperature : primary.temperature;
    const low = night ? night.temperature : primary.temperature;
    const precipDay = day?.probabilityOfPrecipitation?.value ?? null;
    const precipNight = night?.probabilityOfPrecipitation?.value ?? null;
    const precipitationChance =
      precipDay !== null && precipNight !== null
        ? Math.max(precipDay, precipNight)
        : (precipDay ?? precipNight ?? 0);
    result.push({
      date: new Date(dateKey),
      high,
      low,
      precipitationChance,
      description: primary.detailedForecast,
      shortForecast: primary.shortForecast,
    });
  }
  return result;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json(
      { error: 'Missing required query parameters: lat and lng' },
      { status: 400 }
    );
  }

  try {
    const pointsUrl = `https://api.weather.gov/points/${lat},${lng}`;
    const pointsRes = await fetch(pointsUrl, { headers: WEATHER_GOV_HEADERS });
    if (!pointsRes.ok) {
      return NextResponse.json({ error: 'Weather not available for this location' });
    }
    const pointsData = (await pointsRes.json()) as PointsResponse;
    const forecastUrl = pointsData?.properties?.forecast;
    if (!forecastUrl) {
      return NextResponse.json({ error: 'Weather not available for this location' });
    }
    const forecastRes = await fetch(forecastUrl, { headers: WEATHER_GOV_HEADERS });
    if (!forecastRes.ok) {
      return NextResponse.json({ error: 'Weather not available for this location' });
    }
    const forecastData = (await forecastRes.json()) as ForecastResponse;
    const rawPeriods = forecastData?.properties?.periods;
    if (!Array.isArray(rawPeriods) || rawPeriods.length === 0) {
      return NextResponse.json({ error: 'Weather not available for this location' });
    }
    const periods = buildWeatherPeriods(rawPeriods);
    return NextResponse.json({ periods });
  } catch {
    return NextResponse.json({ error: 'Weather not available for this location' });
  }
}