'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Day, Activity } from '@/types';
import { useTrip } from '@/lib/store';
import { getValidationEmoji, getValidationColor } from '@/lib/validation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import AddActivityForm from './AddActivityForm';
import RecommendActivitiesPanel from './RecommendActivitiesPanel';

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
  const { removeActivity, reorderActivities, updateActivity, trip } = useTrip();
  const dogStatus = getDogStatus(day.activities);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeReason, setOptimizeReason] = useState<string | null>(null);
  const [showRecommend, setShowRecommend] = useState(false);
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
      weekday: 'long', month: 'long', day: 'numeric',
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
    if (isOptimizing || day.activities.filter(a => !a.isContinuingStay).length < 2) return;
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
        .map(id => day.activities.find(a => a.id === id))
        .filter(Boolean) as typeof day.activities;

      // Check if order actually changed
      const currentIds = day.activities.map(a => a.id);
      const isSameOrder =
        data.order.length === currentIds.length &&
        data.order.every((id, i) => id === currentIds[i]);

      if (isSameOrder) {
        setOptimizeReason('✨ Already in great shape — no changes needed!');
      } else {
        reorderActivities(day.dayNumber, reordered);
        const nonStay = reordered.filter(a => !a.isContinuingStay);
        const names = nonStay.slice(0, 3).map((a, i) => `${i + 1}. ${a.name}`);
        const suffix = nonStay.length > 3 ? ' → …' : '';
        setOptimizeReason(`✨ Reordered: ${names.join(' → ')}${suffix}`);
      }
      setTimeout(() => setOptimizeReason(null), 10000);
    } catch {
      setOptimizeReason('Could not optimize — try again.');
      setTimeout(() => setOptimizeReason(null), 4000);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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

        {/* Body: two columns */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: Activity list */}
          <div className="flex-1 overflow-y-auto p-4">
            {day.activities.length === 0 && (
              <p className="text-sm text-gray-400 italic text-center py-12">No activities yet — click &quot;+ Add Activity&quot; to get started.</p>
            )}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId={`day-${day.dayNumber}`}>
                {(provided) => (
                  <div
                    className="space-y-2"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {day.activities.map((activity, index) => (
                      <Draggable key={activity.id} draggableId={activity.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                          >
                            {activity.isContinuingStay ? (
                              <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50 opacity-60 group">
                                <span className="text-xl flex-shrink-0 ml-4">{activityIcons[activity.type] ?? '📍'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-500 italic">
                                    {activityIcons[activity.type]} Continuing stay
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
                                className={`flex items-start gap-3 group p-2 rounded-lg cursor-pointer ${
                                  dragSnapshot.isDragging ? 'bg-orange-50 shadow-md' : 'hover:bg-gray-50'
                                }`}
                                onClick={() => setEditingActivity(activity)}
                              >
                                {/* Drag handle + icon */}
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="flex flex-col items-center flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <span className="text-gray-300 text-xs leading-none select-none">⠿</span>
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
                                        title={activity.ticketsPurchased ? 'Tickets purchased — click to toggle' : 'Tickets needed — click to mark purchased'}
                                        className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium cursor-pointer ${
                                          activity.ticketsPurchased
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}
                                      >
                                        {activity.ticketsPurchased ? '🎟️ ✓' : '🎟️ Tickets needed'}
                                      </button>
                                    )}
                                  </div>
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
                                    {activity.showOnMap === false ? '👁️‍🗨️' : '👁️'}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeActivity(activity.id); }}
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

          {/* Right: Status + Actions */}
          <div className="w-64 border-l border-gray-100 bg-gray-50 overflow-y-auto p-4 flex-shrink-0 space-y-3">
            {/* Dog status */}
            {dogStatus === 'dog' && (
              <span className="inline-flex text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">🐕 Dog Day</span>
            )}
            {dogStatus === 'no-dog' && (
              <span className="inline-flex text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">🚫 No Dog</span>
            )}

            {/* Weather */}
            {day.weather && (
              <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full inline-flex">
                {day.weather.high}°/{day.weather.low}° {day.weather.shortForecast}
              </div>
            )}

            {/* Validation messages */}
            {day.validationStatus.messages
              .filter(m => m.level !== 'success' && !dismissedWarnings.has(m.message))
              .map((msg, i) => (
                <div key={i} className="relative">
                  <div className={`text-xs px-2 py-1 pr-6 rounded-full font-medium ${getValidationColor(msg.level)}`}>
                    {getValidationEmoji(msg.level)} {msg.message}
                    <button
                      onClick={() => dismissWarning(msg.message)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-current opacity-50 hover:opacity-100 leading-none"
                      aria-label="Dismiss warning"
                    >
                      ✕
                    </button>
                  </div>
                  {msg.suggestion && (
                    <p className="text-xs text-gray-500 mt-0.5 pl-1">{msg.suggestion}</p>
                  )}
                </div>
              ))}

            {/* Optimize */}
            {day.activities.filter(a => !a.isContinuingStay).length >= 2 && (
              <button
                onClick={handleOptimizeOrder}
                disabled={isOptimizing}
                className="w-full text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-2 rounded-lg border border-orange-200 transition-colors disabled:opacity-50 font-medium"
              >
                {isOptimizing ? '⏳ Optimizing…' : '✨ Optimize Order'}
              </button>
            )}

            {/* Optimize result toast */}
            {optimizeReason && (
              <div className="px-3 py-2 bg-orange-50 border-2 border-orange-300 rounded-lg text-xs text-orange-800 flex items-start gap-2">
                <span className="flex-1">{optimizeReason}</span>
                <button onClick={() => setOptimizeReason(null)} className="flex-shrink-0 text-orange-400 hover:text-orange-600 leading-none">✕</button>
              </div>
            )}

            {/* Find Activities */}
            <button
              onClick={() => setShowRecommend(r => !r)}
              className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 transition-colors font-medium"
            >
              {showRecommend ? '▲ Hide Suggestions' : '🔍 Find Activities'}
            </button>

            {showRecommend && (
              <div className="border-t border-gray-200 pt-2">
                <RecommendActivitiesPanel day={day} onClose={() => setShowRecommend(false)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Activity overlay */}
      {editingActivity && typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.stopPropagation()}>
            <AddActivityForm
              existingActivity={editingActivity}
              onClose={() => setEditingActivity(null)}
            />
          </div>,
          document.body
        )
      }
    </div>
  );
}
