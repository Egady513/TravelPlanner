'use client';

import { useEffect, useState } from 'react';
import { Day, DrivingActivity, CampingSpot, ActivityType } from '@/types';
import { useTrip } from '@/lib/store';
import { fetchWeatherForLocation, getWeatherEmoji } from '@/lib/weather';
import { getValidationEmoji } from '@/lib/validation';
import ActivityIcon, { getActivityColor } from './ActivityIcon';

interface DayCardProps {
  day: Day;
  isSelected: boolean;
  onSelect?: () => void;
}

function getDogStatus(activities: Day['activities']) {
  if (activities.length === 0) return null;
  const hasNoDogActivity = activities.some(a => a.isDogFriendly === false);
  return hasNoDogActivity ? 'no-dog' : 'dog';
}

function getDerivedLabel(day: Day): string {
  if (day.locationLabel) return day.locationLabel;
  const driving = day.activities.find(a => a.type === 'driving') as DrivingActivity | undefined;
  if (driving?.endLocation?.name) return driving.endLocation.name;
  if (day.lodgingActivity?.name) return day.lodgingActivity.name;
  const first = day.activities.find(a => a.type !== 'driving');
  return first?.name ?? '';
}

export default function DayCard({ day, isSelected, onSelect }: DayCardProps) {
  const { setSelectedDay, removeActivity, setDayWeather, setDayLocationLabel } = useTrip();
  const dogStatus = getDogStatus(day.activities);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');

  useEffect(() => {
    if (day.weather || !day.date || day.activities.length === 0) return;
    const firstActivity = day.activities[0];
    const { lat, lng } = firstActivity.coordinates;
    fetchWeatherForLocation(lat, lng, day.date).then(result => {
      if (result) setDayWeather(day.dayNumber, result);
    });
  }, [day.dayNumber, day.date, day.activities.length, day.weather, setDayWeather]);

  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
  };

  const derivedLabel = getDerivedLabel(day);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLabelDraft(derivedLabel);
    setIsEditingLabel(true);
  };

  const handleLabelSave = () => {
    setDayLocationLabel(day.dayNumber, labelDraft.trim());
    setIsEditingLabel(false);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLabelSave();
    if (e.key === 'Escape') setIsEditingLabel(false);
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
      <div className="flex items-center justify-between mb-1">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">Day {day.dayNumber}</h3>

          {/* Location label — inline editable */}
          {isEditingLabel ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={handleLabelKeyDown}
              onClick={e => e.stopPropagation()}
              className="text-sm font-semibold text-gray-700 w-full border-b border-blue-400 outline-none bg-transparent mt-0.5"
              placeholder="e.g. Tetons"
            />
          ) : (
            <p
              className={`text-sm font-semibold truncate mt-0.5 cursor-pointer hover:text-blue-600 transition-colors ${
                derivedLabel ? 'text-gray-700' : 'text-gray-400 italic text-xs font-normal'
              }`}
              onClick={handleLabelClick}
            >
              {derivedLabel || 'Click to set location'}
            </p>
          )}

          {day.date && (
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(day.date)}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-sm text-gray-500">
            {day.activities.filter(a => !a.isContinuingStay).length} {day.activities.filter(a => !a.isContinuingStay).length === 1 ? 'activity' : 'activities'}
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

      {day.activities.filter(a => !a.isContinuingStay).length > 0 && (
        <div className="space-y-1.5 mt-2">
          {day.activities.filter(a => !a.isContinuingStay).map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-2 text-sm group"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex-shrink-0 mt-0.5">
                <ActivityIcon type={activity.type as ActivityType} size={15} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`font-medium truncate ${getActivityColor(activity.type as ActivityType)}`}>
                    {activity.name}
                  </p>
                  {/* Campsite primary/backup badge */}
                  {activity.type === 'camping' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      (activity as CampingSpot).isPrimary === false
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {(activity as CampingSpot).isPrimary === false ? '◦ Backup' : '★ Primary'}
                    </span>
                  )}
                </div>
                {activity.type === 'driving' && (activity as DrivingActivity).waypoints?.length ? (
                  <div className="mt-0.5 space-y-0.5">
                    {(activity as DrivingActivity).waypoints!.map((wp, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-gray-400">
                        <span className="text-gray-300 flex-shrink-0">↳</span>
                        <span className="truncate">📍 {wp.name}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
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

      {day.activities.filter(a => !a.isContinuingStay).length === 0 && (
        <p className="text-sm text-gray-400 italic">No activities yet</p>
      )}
    </div>
  );
}
