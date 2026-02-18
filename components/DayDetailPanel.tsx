'use client';

import { Day, Activity } from '@/types';
import { useTrip } from '@/lib/store';
import { getValidationEmoji, getValidationColor } from '@/lib/validation';

interface DayDetailPanelProps {
  day: Day;
  onClose: () => void;
  onAddActivity: () => void;
}

const activityIcons: Record<string, string> = {
  trail: '🥾',
  hotel: '🏨',
  restaurant: '🍽️',
  camping: '⛺',
  park: '🏞️',
  driving: '🚗',
};

function getDogStatus(activities: Activity[]) {
  if (activities.length === 0) return null;
  return activities.some(a => a.isDogFriendly === false) ? 'no-dog' : 'dog';
}

export default function DayDetailPanel({ day, onClose, onAddActivity }: DayDetailPanelProps) {
  const { removeActivity } = useTrip();
  const dogStatus = getDogStatus(day.activities);

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-80 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="font-bold text-gray-900">Day {day.dayNumber}</h3>
          {day.date && <p className="text-xs text-gray-500">{formatDate(day.date)}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
          ✕
        </button>
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-wrap">
        {dogStatus === 'dog' && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">🐕 Dog Day</span>
        )}
        {dogStatus === 'no-dog' && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">🚫 No Dog</span>
        )}
        {day.validationStatus.level !== 'success' && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getValidationColor(day.validationStatus.level)}`}>
            {getValidationEmoji(day.validationStatus.level)} {day.validationStatus.messages[0]?.message}
          </span>
        )}
        {day.weather && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
            {day.weather.high}°/{day.weather.low}° {day.weather.shortForecast}
          </span>
        )}
      </div>

      {/* Activities Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {day.activities.length === 0 && (
          <p className="text-sm text-gray-400 italic text-center py-8">No activities yet</p>
        )}
        <div className="space-y-2">
          {day.activities.map((activity, index) => (
            <div key={activity.id} className="flex items-start gap-3 group p-2 rounded-lg hover:bg-gray-50">
              <div className="flex flex-col items-center">
                <span className="text-xl">{activityIcons[activity.type] ?? '📍'}</span>
                {index < day.activities.length - 1 && (
                  <div className="w-0.5 h-4 bg-gray-200 mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{activity.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 capitalize">{activity.type}</span>
                  {activity.isDogFriendly ? (
                    <span className="text-xs text-green-600">🐕</span>
                  ) : (
                    <span className="text-xs text-red-500">🚫</span>
                  )}
                </div>
                {activity.notes && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{activity.notes}</p>
                )}
              </div>
              <button
                onClick={() => removeActivity(activity.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs p-1"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Activity CTA */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onAddActivity}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <span>+</span>
          <span>Add Activity to Day {day.dayNumber}</span>
        </button>
      </div>
    </div>
  );
}
