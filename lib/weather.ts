import { WeatherData } from '@/types';

// Calls our Next.js proxy route (/api/weather) which in turn calls Weather.gov.
// Returns null on any error.
export async function fetchWeatherForLocation(
  lat: number,
  lng: number,
  date: Date
): Promise<WeatherData | null> {
  try {
    const url = `/api/weather?lat=${lat}&lng=${lng}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null || 'error' in data) {
      return null;
    }
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.periods) && record.periods.length > 0) {
      const periods = record.periods as WeatherData[];
      const target = date.getTime();
      let best = periods[0];
      let bestDiff = Math.abs(new Date(best.date).getTime() - target);
      for (const period of periods) {
        const diff = Math.abs(new Date(period.date).getTime() - target);
        if (diff < bestDiff) {
          best = period;
          bestDiff = diff;
        }
      }
      return {
        date: new Date(best.date),
        high: Number(best.high),
        low: Number(best.low),
        precipitationChance: Number(best.precipitationChance),
        description: String(best.description),
        shortForecast: String(best.shortForecast),
      };
    }
    return {
      date: new Date(record.date as string | number),
      high: Number(record.high),
      low: Number(record.low),
      precipitationChance: Number(record.precipitationChance),
      description: String(record.description),
      shortForecast: String(record.shortForecast),
    };
  } catch {
    return null;
  }
}

export function getWeatherEmoji(weather: WeatherData): string {
  const forecast = weather.shortForecast.toLowerCase();
  if (forecast.includes('thunderstorm') || forecast.includes('thunder')) {
    return '⛈️';
  }
  if (forecast.includes('snow') || forecast.includes('blizzard') || forecast.includes('sleet')) {
    return '🌨️';
  }
  if (forecast.includes('fog') || forecast.includes('mist') || forecast.includes('haze')) {
    return '🌫️';
  }
  if (forecast.includes('shower') || forecast.includes('drizzle')) {
    return '🌦️';
  }
  if (forecast.includes('rain') || forecast.includes('precipitation')) {
    return '🌧️';
  }
  if (
    forecast.includes('partly cloudy') ||
    forecast.includes('partly sunny') ||
    forecast.includes('mostly cloudy')
  ) {
    return '⛅';
  }
  if (
    forecast.includes('sunny') ||
    forecast.includes('clear') ||
    forecast.includes('mostly sunny') ||
    forecast.includes('mostly clear')
  ) {
    return '☀️';
  }
  return '⛅';
}

export function getWeatherWarning(weather: WeatherData): string | null {
  if (weather.precipitationChance >= 70) {
    return 'Rain likely - camping may be miserable';
  }
  if (weather.high >= 100) {
    return 'Extreme heat warning';
  }
  if (weather.low <= 20) {
    return 'Extreme cold warning';
  }
  return null;
}