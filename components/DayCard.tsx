'use client';

import { Day } from '@/types';
import { useTrip } from '@/lib/store';

interface DayCardProps {
  day: Day;
  isSelected: boolean;
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

export default function DayCard({ day, isSelected }: DayCardProps) {
  const { setSelectedDay, removeActivity } = useTrip();

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
      onClick={() => setSelectedDay(day.dayNumber)}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">Day {day.dayNumber}</h3>
          {day.date && (
            <p className="text-xs text-gray-500">{formatDate(day.date)}</p>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {day.activities.length} {day.activities.length === 1 ? 'activity' : 'activities'}
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
