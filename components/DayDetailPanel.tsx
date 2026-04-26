'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Day, Activity, DrivingActivity } from '@/types';
import { useTrip } from '@/lib/store';
import { getValidationEmoji, getValidationColor } from '@/lib/validation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import AddActivityForm from './AddActivityForm';
import ActivityDiscoveryModal from './ActivityDiscoveryModal';

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
  activity: '🎡',
  scenic: '🌄',
};

function getDogStatus(activities: Activity[]) {
  if (activities.length === 0) return null;
  return activities.some(a => a.isDogFriendly === false) ? 'no-dog' : 'dog';
}

function formatDriveHours(hours: number) {
  if (hours <= 0) return null;
  return hours % 1 === 0 ? `${hours.toFixed(0)}h` : `${hours.toFixed(1)}h`;
}

function getRouteSummary(day: Day) {
  const plannedActivities = day.activities.filter(activity => !activity.isContinuingStay);
  const drives = plannedActivities.filter(activity => activity.type === 'driving') as DrivingActivity[];
  const firstDrive = drives[0];
  const lastDrive = drives[drives.length - 1];

  return {
    plannedActivities,
    drives,
    startLabel: firstDrive?.startLocation.name ?? null,
    endLabel: lastDrive?.endLocation.name ?? null,
    totalDriveHours: drives.reduce((sum, drive) => sum + (drive.estimatedDriveHours ?? 0), 0),
    routeStops: drives.reduce((sum, drive) => sum + (drive.waypoints?.length ?? 0), 0),
    exploreStops: plannedActivities.filter(activity => activity.type !== 'driving').length,
  };
}

export default function DayDetailPanel({ day, onClose, onAddActivity }: DayDetailPanelProps) {
  const { removeActivity, reorderActivities, updateActivity, trip } = useTrip();
  const dogStatus = getDogStatus(day.activities);
  const routeSummary = getRouteSummary(day);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeReason, setOptimizeReason] = useState<string | null>(null);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  const dismissWarning = (message: string) => {
    setDismissedWarnings(prev => new Set(prev).add(message));
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(d);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const reordered = Array.from(day.activities);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    reorderActivities(day.dayNumber, reordered);
  };

  const handleOptimizeOrder = async () => {
    if (isOptimizing || routeSummary.plannedActivities.length < 2) return;
    setIsOptimizing(true);
    setOptimizeReason(null);
    try {
      const res = await fetch('/api/scout/optimize-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, trip }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { order: string[]; reasoning: string };
      const reordered = data.order
        .map(id => day.activities.find(activity => activity.id === id))
        .filter(Boolean) as typeof day.activities;

      const currentIds = day.activities.map(activity => activity.id);
      const isSameOrder =
        data.order.length === currentIds.length &&
        data.order.every((id, i) => id === currentIds[i]);

      if (isSameOrder) {
        setOptimizeReason('Already in great shape. No changes needed.');
      } else {
        reorderActivities(day.dayNumber, reordered);
        const nonStay = reordered.filter(activity => !activity.isContinuingStay);
        const names = nonStay.slice(0, 3).map((activity, i) => `${i + 1}. ${activity.name}`);
        const suffix = nonStay.length > 3 ? ' -> ...' : '';
        setOptimizeReason(`Reordered: ${names.join(' -> ')}${suffix}`);
      }
      setTimeout(() => setOptimizeReason(null), 10000);
    } catch {
      setOptimizeReason('Could not optimize. Try again.');
      setTimeout(() => setOptimizeReason(null), 4000);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Day {day.dayNumber}</h3>
            {day.date && <p className="text-sm text-gray-500">{formatDate(day.date)}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddActivity}
              className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              + Add Activity
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-lg" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            {day.activities.length === 0 && (
              <p className="text-sm text-gray-400 italic text-center py-12">
                No activities yet. Click &quot;+ Add Activity&quot; to get started.
              </p>
            )}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId={`day-${day.dayNumber}`}>
                {(provided) => (
                  <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
                    {day.activities.map((activity, index) => (
                      <Draggable key={activity.id} draggableId={activity.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                            {activity.isContinuingStay ? (
                              <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50 opacity-60 group">
                                <span className="text-xl flex-shrink-0 ml-4">{activityIcons[activity.type] ?? '📍'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-500 italic">
                                    Continuing stay
                                    {activity.parentDayNumber ? ` (from Day ${activity.parentDayNumber})` : ''}
                                  </p>
                                  <p className="text-xs text-gray-400 truncate">{activity.name}</p>
                                </div>
                                <button
                                  onClick={() => removeActivity(activity.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs p-1"
                                  aria-label="Remove continuing stay"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div
                                className={`flex items-start gap-3 group p-3 rounded-lg cursor-pointer border ${
                                  dragSnapshot.isDragging
                                    ? 'bg-orange-50 border-orange-200 shadow-md'
                                    : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
                                }`}
                                onClick={() => setEditingActivity(activity)}
                              >
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="flex flex-col items-center flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <span className="text-gray-300 text-xs leading-none select-none">⋮⋮</span>
                                  <span className="text-xl mt-0.5">{activityIcons[activity.type] ?? '📍'}</span>
                                  {index < day.activities.length - 1 && (
                                    <div className="w-0.5 h-4 bg-gray-200 mt-1" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-gray-900 text-sm truncate">{activity.name}</p>
                                    {activity.requiresTickets === true && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateActivity(activity.id, { ticketsPurchased: !activity.ticketsPurchased });
                                        }}
                                        title={activity.ticketsPurchased ? 'Tickets purchased - click to toggle' : 'Tickets needed - click to mark purchased'}
                                        className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium cursor-pointer ${
                                          activity.ticketsPurchased
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}
                                      >
                                        {activity.ticketsPurchased ? 'Tickets ready' : 'Tickets needed'}
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs text-gray-500 capitalize">{activity.type}</span>
                                    {activity.isDogFriendly ? (
                                      <span className="text-xs text-green-600">Dog-friendly</span>
                                    ) : (
                                      <span className="text-xs text-red-500">Not dog-friendly</span>
                                    )}
                                  </div>
                                  {activity.notes && (
                                    <p className="text-xs text-gray-400 mt-1 truncate">{activity.notes}</p>
                                  )}
                                  {activity.type === 'driving' && (
                                    <div className="mt-1 space-y-1">
                                      <p className="text-xs text-gray-500">
                                        {(activity as DrivingActivity).startLocation.name} {'->'} {(activity as DrivingActivity).endLocation.name}
                                      </p>
                                      <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                                        {(activity as DrivingActivity).estimatedDriveHours && (
                                          <span>{formatDriveHours((activity as DrivingActivity).estimatedDriveHours ?? 0)}</span>
                                        )}
                                        {(activity as DrivingActivity).estimatedDriveDistance && (
                                          <span>{(activity as DrivingActivity).estimatedDriveDistance}</span>
                                        )}
                                        {(activity as DrivingActivity).departureTime && (
                                          <span>leave {(activity as DrivingActivity).departureTime}</span>
                                        )}
                                        {(activity as DrivingActivity).arrivalTime && (
                                          <span>arrive {(activity as DrivingActivity).arrivalTime}</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateActivity(activity.id, { showOnMap: activity.showOnMap === false ? true : false });
                                    }}
                                    className="text-gray-400 hover:text-gray-600 text-xs p-1"
                                    title={activity.showOnMap === false ? 'Show on map' : 'Hide from map'}
                                    aria-label={activity.showOnMap === false ? 'Show on map' : 'Hide from map'}
                                  >
                                    {activity.showOnMap === false ? 'Show' : 'Hide'}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeActivity(activity.id);
                                    }}
                                    className="text-red-400 hover:text-red-600 text-xs p-1"
                                    aria-label="Remove"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          <div className="w-72 border-l border-gray-100 bg-gray-50 overflow-y-auto p-4 flex-shrink-0 space-y-3">
            {(routeSummary.startLabel || routeSummary.endLabel) && (
              <div className="rounded-xl border border-orange-200 bg-white p-3 space-y-2 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Route plan</p>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {routeSummary.endLabel ?? 'Destination not set'}
                  </p>
                  {routeSummary.startLabel && routeSummary.endLabel && (
                    <p className="text-xs text-gray-500 mt-1">
                      {routeSummary.startLabel} {'->'} {routeSummary.endLabel}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  {formatDriveHours(routeSummary.totalDriveHours) && (
                    <span>{formatDriveHours(routeSummary.totalDriveHours)} total drive</span>
                  )}
                  {routeSummary.routeStops > 0 && (
                    <span>{routeSummary.routeStops} route stop{routeSummary.routeStops === 1 ? '' : 's'}</span>
                  )}
                  {routeSummary.exploreStops > 0 && (
                    <span>{routeSummary.exploreStops} things to do</span>
                  )}
                </div>
                {routeSummary.plannedActivities.length >= 2 && (
                  <button
                    onClick={handleOptimizeOrder}
                    disabled={isOptimizing}
                    className="w-full text-xs text-orange-700 hover:text-orange-800 hover:bg-orange-50 px-3 py-2 rounded-lg border border-orange-200 transition-colors disabled:opacity-50 font-medium"
                  >
                    {isOptimizing ? 'Optimizing route...' : routeSummary.drives.length > 0 ? 'Optimize route order' : 'Optimize stop order'}
                  </button>
                )}
              </div>
            )}

            {dogStatus === 'dog' && (
              <span className="inline-flex text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Dog day</span>
            )}
            {dogStatus === 'no-dog' && (
              <span className="inline-flex text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Dog conflict</span>
            )}

            {day.weather && (
              <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full inline-flex">
                {day.weather.high}°/{day.weather.low}° {day.weather.shortForecast}
              </div>
            )}

            {day.validationStatus.messages
              .filter(message => message.level !== 'success' && !dismissedWarnings.has(message.message))
              .map((message) => (
                <div key={message.message}>
                  <div className={`relative text-xs px-2 py-1 pr-6 rounded-full font-medium ${getValidationColor(message.level)}`}>
                    {getValidationEmoji(message.level)} {message.message}
                    <button
                      onClick={() => dismissWarning(message.message)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-current opacity-50 hover:opacity-100 leading-none"
                      aria-label="Dismiss warning"
                    >
                      ✕
                    </button>
                  </div>
                  {message.suggestion && (
                    <p className="text-xs text-gray-500 mt-0.5 pl-1">{message.suggestion}</p>
                  )}
                </div>
              ))}

            {optimizeReason && (
              <div className="px-3 py-2 bg-orange-50 border-2 border-orange-300 rounded-lg text-xs text-orange-800 flex items-start gap-2">
                <span className="flex-1">{optimizeReason}</span>
                <button onClick={() => setOptimizeReason(null)} className="flex-shrink-0 text-orange-400 hover:text-orange-600 leading-none">✕</button>
              </div>
            )}

            <button
              onClick={() => setShowDiscovery(true)}
              className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 transition-colors font-medium"
            >
              Find activities
            </button>
          </div>
        </div>
      </div>

      {showDiscovery && (
        <ActivityDiscoveryModal day={day} onClose={() => setShowDiscovery(false)} />
      )}

      {editingActivity && typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.stopPropagation()}>
            <AddActivityForm existingActivity={editingActivity} onClose={() => setEditingActivity(null)} />
          </div>,
          document.body
        )}
    </div>
  );
}
