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
  onAddActivity?: () => void;
}

function getDogStatus(activities: Day['activities']) {
  if (activities.length === 0) return null;
  return activities.some(a => a.isDogFriendly === false) ? 'no-dog' : 'dog';
}

function getDerivedLabel(day: Day): string {
  if (day.locationLabel) return day.locationLabel;
  const driving = day.activities.find(a => a.type === 'driving' && !a.isContinuingStay) as DrivingActivity | undefined;
  if (driving?.endLocation?.name) return driving.endLocation.name;
  if (day.lodgingActivity?.name) return day.lodgingActivity.name;
  const first = day.activities.find(a => a.type !== 'driving' && !a.isContinuingStay);
  if (first?.name) return first.name;
  const continuing = day.activities.find(a => a.isContinuingStay);
  return continuing?.name ?? '';
}

interface LodgingInfo {
  name: string;
  isContinuing: boolean;
  activityId: string;
  missingCoords: boolean;
}

function getLodgingInfo(day: Day): LodgingInfo | null {
  // Check continuing stays first (multi-night hotel/camp from a prior day)
  const continuingLodging = day.activities.find(
    a => a.isContinuingStay && (a.type === 'hotel' || a.type === 'camping')
  );
  if (continuingLodging) {
    return {
      name: continuingLodging.name,
      isContinuing: true,
      activityId: continuingLodging.id,
      missingCoords: false,
    };
  }

  // Find real lodging on this day (hotel or camping)
  const candidates = day.activities.filter(
    a => !a.isContinuingStay && (a.type === 'hotel' || a.type === 'camping')
  );
  if (candidates.length === 0) return null;

  // Prefer isPrimary camping, then first hotel, then any
  const primary = candidates.find(
    a => a.type === 'camping' && (a as CampingSpot).isPrimary !== false
  );
  const chosen = primary ?? candidates[0];

  const missingCoords =
    chosen.type === 'camping' &&
    (chosen.coordinates.lat === 0 && chosen.coordinates.lng === 0);

  return {
    name: chosen.name,
    isContinuing: false,
    activityId: chosen.id,
    missingCoords,
  };
}

export default function DayCard({ day, isSelected, onAddActivity }: DayCardProps) {
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
  const lodging = getLodgingInfo(day);

  // Activities shown in the list — exclude the lodging that's shown in the pill
  // (to avoid duplication when the hotel/camp is a real activity on this day)
  const realActivities = day.activities.filter(
    a => !a.isContinuingStay && a.id !== lodging?.activityId
  );

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
      className={`rounded-2xl cursor-pointer transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'shadow-lg ring-2 ring-blue-400 ring-offset-1'
          : 'shadow-sm hover:shadow-md'
      }`}
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: isSelected ? '1px solid #93c5fd' : '1px solid #e2e8f0',
      }}
      onClick={() => setSelectedDay(day.dayNumber)}
    >
      {/* Top accent bar */}
      <div
        className="h-0.5 w-full"
        style={{
          background: isSelected
            ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
            : 'linear-gradient(90deg, #cbd5e1, #e2e8f0)',
        }}
      />

      <div className="p-3">
        {/* Day number + badges row */}
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-bold tracking-widest uppercase ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
            Day {day.dayNumber}
          </span>
          <div className="flex items-center gap-1.5">
            {dogStatus === 'dog' && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">🐕</span>
            )}
            {dogStatus === 'no-dog' && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">🚫</span>
            )}
            {day.validationStatus.level !== 'success' && (
              <span className="text-xs">{getValidationEmoji(day.validationStatus.level)}</span>
            )}
            {day.weather && (
              <span className="text-xs text-gray-500 font-medium">
                {getWeatherEmoji(day.weather)} {day.weather.high}°
              </span>
            )}
          </div>
        </div>

        {/* City label — prominent, full-width */}
        {isEditingLabel ? (
          <input
            autoFocus
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onBlur={handleLabelSave}
            onKeyDown={handleLabelKeyDown}
            onClick={e => e.stopPropagation()}
            className="w-full text-lg font-bold text-gray-900 border-b-2 border-blue-400 outline-none bg-transparent mb-1"
            placeholder="e.g. Tetons"
          />
        ) : (
          <p
            className={`text-lg font-bold leading-tight mb-1 cursor-pointer hover:text-blue-600 transition-colors ${
              derivedLabel ? 'text-gray-900' : 'text-gray-300 italic text-sm font-normal'
            }`}
            onClick={handleLabelClick}
            title="Click to rename"
          >
            {derivedLabel || 'Set location'}
          </p>
        )}

        {/* Date */}
        {day.date && (
          <p className="text-xs text-gray-400 mb-2">{formatDate(day.date)}</p>
        )}

        {/* Lodging pill — always shown */}
        {lodging ? (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1.5">
              <span className="flex-shrink-0">
                {lodging.name.toLowerCase().includes('camp') ? '⛺' : '🏨'}
              </span>
              <span className="truncate font-medium">
                {lodging.isContinuing ? 'Staying at ' : 'Tonight: '}
                {lodging.name}
              </span>
            </div>
            {lodging.missingCoords && (
              <p className="text-xs text-red-500 mt-0.5 pl-1">Missing camp coordinates</p>
            )}
          </div>
        ) : (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 text-xs bg-red-50 rounded-lg px-2 py-1.5 border border-red-200">
              <span className="flex-shrink-0">🏕️</span>
              <span className="font-bold text-red-600 tracking-wide">MISSING LODGING</span>
            </div>
          </div>
        )}

        {/* Activity list — lodging already shown in pill above, excluded here */}
        {realActivities.length > 0 && (
          <div className="space-y-1 mt-1">
            {realActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-1.5 text-sm group"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="flex-shrink-0 mt-0.5">
                  <ActivityIcon type={activity.type as ActivityType} size={13} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <p className={`text-sm font-medium truncate ${getActivityColor(activity.type as ActivityType)}`}>
                      {activity.name}
                    </p>
                    {activity.type === 'camping' && (
                      <span className={`text-xs px-1 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        (activity as CampingSpot).isPrimary === false
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {(activity as CampingSpot).isPrimary === false ? '◦' : '★'}
                      </span>
                    )}
                  </div>
                  {activity.type === 'driving' && (activity as DrivingActivity).waypoints?.length ? (
                    <div className="space-y-0.5 mt-0.5">
                      {(activity as DrivingActivity).waypoints!.map((wp, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs text-gray-400">
                          <span className="text-gray-300 flex-shrink-0">↳</span>
                          <span className="truncate">{wp.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={() => removeActivity(activity.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs flex-shrink-0"
                  aria-label="Remove activity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {realActivities.length === 0 && (
          <p className="text-xs text-gray-300 italic">No activities planned</p>
        )}

        {/* Add activity button */}
        {onAddActivity && (
          <div className="flex justify-end mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDay(day.dayNumber);
                onAddActivity();
              }}
              className="text-xs text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-full w-6 h-6 flex items-center justify-center transition-colors border border-transparent hover:border-orange-200"
              aria-label="Add activity"
              title="Add activity"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
