'use client';

import { useEffect } from 'react';
import { Day, DrivingActivity } from '@/types';
import { useTrip } from '@/lib/store';
import { fetchWeatherForLocation, getWeatherEmoji } from '@/lib/weather';
import { getValidationEmoji } from '@/lib/validation';

interface DayCardProps {
  day: Day;
  isSelected: boolean;
  onSelect?: () => void;
  onOpenDetails?: () => void;
}

const activityIcons: Record<string, string> = {
  trail: '🥾',
  hotel: '🏨',
  restaurant: '🍽️',
  camping: '⛺',
  park: '🏞️',
  driving: '🚗',
  activity: '🎡',
  scenic: '🌄',
};

const activityColors: Record<string, string> = {
  trail: 'text-green-600',
  hotel: 'text-blue-600',
  restaurant: 'text-orange-600',
  camping: 'text-amber-700',
  park: 'text-emerald-700',
  driving: 'text-gray-600',
  activity: 'text-fuchsia-600',
  scenic: 'text-cyan-700',
};

function getDogStatus(activities: Day['activities']) {
  if (activities.length === 0) return null;
  const hasNoDogActivity = activities.some(a => a.isDogFriendly === false);
  return hasNoDogActivity ? 'no-dog' : 'dog';
}

function formatDriveHours(hours: number) {
  if (hours <= 0) return null;
  return hours % 1 === 0 ? `${hours.toFixed(0)}h` : `${hours.toFixed(1)}h`;
}

export default function DayCard({ day, isSelected, onSelect, onOpenDetails }: DayCardProps) {
  const { setSelectedDay, removeActivity, setDayWeather } = useTrip();
  const dogStatus = getDogStatus(day.activities);
  const plannedActivities = day.activities.filter(a => !a.isContinuingStay);
  const drivingActivities = plannedActivities.filter(a => a.type === 'driving') as DrivingActivity[];
  const nonDrivingActivities = plannedActivities.filter(a => a.type !== 'driving');
  const firstDrive = drivingActivities[0];
  const lastDrive = drivingActivities[drivingActivities.length - 1];
  const totalDriveHours = drivingActivities.reduce((sum, drive) => sum + (drive.estimatedDriveHours ?? 0), 0);
  const routeStops = drivingActivities.reduce((sum, drive) => sum + (drive.waypoints?.length ?? 0), 0);
  const destinationName =
    lastDrive?.endLocation?.name ??
    nonDrivingActivities[nonDrivingActivities.length - 1]?.name ??
    '';
  const routeSummary =
    firstDrive && lastDrive
      ? `${firstDrive.startLocation.name} -> ${lastDrive.endLocation.name}`
      : '';
  const visibleHighlights = nonDrivingActivities.slice(0, 3);
  const remainingHighlights = Math.max(nonDrivingActivities.length - visibleHighlights.length, 0);
  const planningStatus = day.validationStatus.level === 'error'
    ? 'Needs attention'
    : day.validationStatus.level === 'warning'
      ? 'Worth reviewing'
      : plannedActivities.length === 0
        ? 'Still unplanned'
        : drivingActivities.length > 0 && nonDrivingActivities.length === 0
          ? 'Route day'
          : 'Ready to shape';

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

  return (
    <div
      className={`border rounded-xl p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-orange-400 bg-orange-50 shadow-md'
          : 'border-gray-200 hover:border-orange-200 hover:shadow-sm bg-white'
      }`}
      onClick={() => {
        setSelectedDay(day.dayNumber);
        onSelect?.();
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Day {day.dayNumber}
          </p>
          {day.date ? (
            <h3 className="font-semibold text-gray-900">{formatDate(day.date)}</h3>
          ) : (
            <h3 className="font-semibold text-gray-900">Plan this day</h3>
          )}
          <p className="text-sm text-gray-500 mt-0.5">{planningStatus}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-sm text-gray-500">
            {plannedActivities.length} {plannedActivities.length === 1 ? 'item' : 'items'}
          </span>
          {dogStatus === 'dog' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Dog OK
            </span>
          )}
          {dogStatus === 'no-dog' && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              Dog conflict
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

      {destinationName && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Destination</p>
          <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{destinationName}</p>
          {routeSummary && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 mt-3">Route</p>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{routeSummary}</p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                {formatDriveHours(totalDriveHours) && <span>{formatDriveHours(totalDriveHours)} driving</span>}
                {routeStops > 0 && <span>{routeStops} route stop{routeStops === 1 ? '' : 's'}</span>}
                {nonDrivingActivities.length > 0 && (
                  <span>{nonDrivingActivities.length} things to do</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {visibleHighlights.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 mb-1.5">Highlights</p>
          <div className="space-y-1.5">
            {visibleHighlights.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-2 text-sm group"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-base flex-shrink-0">
                  {activityIcons[activity.type] ?? '📍'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${activityColors[activity.type] ?? 'text-gray-700'}`}>
                    {activity.name}
                  </p>
                  {activity.isDogFriendly && (
                    <span className="text-xs text-green-600">Dog-friendly</span>
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
          {remainingHighlights > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              +{remainingHighlights} more planned stop{remainingHighlights === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}

      {drivingActivities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Route blocks</p>
          {drivingActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-2 text-sm group"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-base flex-shrink-0">
                {activityIcons[activity.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${activityColors[activity.type] ?? 'text-gray-700'}`}>
                  {activity.startLocation.name} {'->'} {activity.endLocation.name}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-400 mt-0.5">
                  {activity.estimatedDriveHours && <span>{formatDriveHours(activity.estimatedDriveHours)}</span>}
                  {activity.estimatedDriveDistance && <span>{activity.estimatedDriveDistance}</span>}
                  {activity.departureTime && <span>leave {activity.departureTime}</span>}
                  {activity.arrivalTime && <span>arrive {activity.arrivalTime}</span>}
                </div>
                {activity.waypoints?.length ? (
                  <div className="mt-1 space-y-0.5">
                    {activity.waypoints.map((wp, i) => (
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
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 text-xs"
                aria-label="Remove route block"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {plannedActivities.length === 0 && (
        <p className="text-sm text-gray-400 italic">No activities yet</p>
      )}

      {onOpenDetails && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            setSelectedDay(day.dayNumber);
            onOpenDetails();
          }}
          className="mt-4 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900"
        >
          Open day planner
        </button>
      )}
    </div>
  );
}
