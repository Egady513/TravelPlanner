'use client';

import { Day, Activity } from '@/types';
import { useTrip } from '@/lib/store';
import { getValidationEmoji, getValidationColor } from '@/lib/validation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

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
  const { removeActivity, reorderActivities, updateActivity } = useTrip();
  const dogStatus = getDogStatus(day.activities);

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
        {day.validationStatus.level !== 'success' && day.validationStatus.messages.filter(m => m.level !== 'success').map((msg, i) => (
          <div key={i} className="w-full">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getValidationColor(msg.level)}`}>
              {getValidationEmoji(msg.level)} {msg.message}
            </span>
            {msg.suggestion && (
              <p className="text-xs text-gray-500 mt-0.5 pl-1">{msg.suggestion}</p>
            )}
          </div>
        ))}
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
                            className={`flex items-start gap-3 group p-2 rounded-lg ${
                              dragSnapshot.isDragging ? 'bg-orange-50 shadow-md' : 'hover:bg-gray-50'
                            }`}
                          >
                            {/* Drag handle + icon */}
                            <div
                              {...dragProvided.dragHandleProps}
                              className="flex flex-col items-center flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing"
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateActivity(activity.id, { showOnMap: activity.showOnMap === false ? true : false });
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 text-xs p-1"
                              title={activity.showOnMap === false ? 'Show on map' : 'Hide from map'}
                              aria-label={activity.showOnMap === false ? 'Show on map' : 'Hide from map'}
                            >
                              {activity.showOnMap === false ? '👁️‍🗨️' : '👁️'}
                            </button>
                            <button
                              onClick={() => removeActivity(activity.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs p-1"
                              aria-label="Remove"
                            >
                              ✕
                            </button>
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
