'use client';

import { useEffect } from 'react';
import { Day } from '@/types';
import { useTrip } from '@/lib/store';
import { fetchWeatherForLocation, getWeatherEmoji } from '@/lib/weather';
import { getValidationEmoji } from '@/lib/validation';

interface DayCardProps {
  day: Day;
  isSelected: boolean;
  onSelect?: () => void;
}

const activityIcons: Record<string, string> = {
  trail: '🥾',
  hotel: '🏨',
  restaurant: '🍽️',
  camping: '⛺',
  park: '🏞️',
  driving: '🚗',
};

const activityColors: Record<string, string> = {
  trail: 'text-green-600',
  hotel: 'text-blue-600',
  restaurant: 'text-orange-600',
  camping: 'text-amber-700',
  park: 'text-emerald-700',
  driving: 'text-gray-600',
};

function getDogStatus(activities: Day['activities']) {
  if (activities.length === 0) return null;
  const hasNoDogActivity = activities.some(a => a.isDogFriendly === false);
  return hasNoDogActivity ? 'no-dog' : 'dog';
}

export default function DayCard({ day, isSelected, onSelect }: DayCardProps) {
  const { setSelectedDay, removeActivity, setDayWeather } = useTrip();
  const dogStatus = getDogStatus(day.activities);

  useEffect(() => {
    if (day.weather || !day.date || day.activities.length === 0) return;
    const firstActivity = day.activities[0];
    const { lat, lng } = firstActivity.coordinates;
    fetchWeatherForLocation(lat, lng, day.date).then(result => {
      if (result) setDayWeather(day.dayNumber, result);
    });
  }, [day.dayNumber, day.date, day.activities.length, day.weather, setDayWeather]);

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
      onClick={() => {
        setSelectedDay(day.dayNumber);
        onSelect?.();
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">Day {day.dayNumber}</h3>
          {day.date && (
            <p className="text-xs text-gray-500">{formatDate(day.date)}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {day.activities.length} {day.activities.length === 1 ? 'activity' : 'activities'}
          </span>
          {dogStatus === 'dog' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              🐕 Dog
            </span>
          )}
          {dogStatus === 'no-dog' && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              🚫 No Dog
            </span>
          )}
          {day.validationStatus.level !== 'success' && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium">
              {getValidationEmoji(day.validationStatus.level)}
            </span>
          )}
          {day.weather && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {getWeatherEmoji(day.weather)} {day.weather.high}°
            </span>
          )}
        </div>
      </div>

      {day.activities.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {day.activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-2 text-sm group"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-base flex-shrink-0">
                {activityIcons[activity.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${activityColors[activity.type]}`}>
                  {activity.name}
                </p>
                {activity.isDogFriendly && (
                  <span className="text-xs text-green-600">🐕 Dog-friendly</span>
                )}
              </div>
              <button
                onClick={() => removeActivity(activity.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 text-xs"
                aria-label="Remove activity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {day.activities.length === 0 && (
        <p className="text-sm text-gray-400 italic">No activities yet</p>
      )}
    </div>
  );
}
