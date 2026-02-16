'use client';

import { useState } from 'react';
import { useTrip } from '@/lib/store';
import DayCard from './DayCard';

export default function Sidebar() {
  const { trip, clearTrip, selectedDay } = useTrip();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!trip) return null;

  const formatDateRange = () => {
    const start = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(trip.startDate);
    const end = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(trip.endDate);
    return `${start} - ${end}`;
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
          isCollapsed ? 'w-12' : 'w-80'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-900 truncate">{trip.name}</h2>
              <p className="text-xs text-gray-500">{formatDateRange()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'}
              </p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-500 hover:text-gray-700 p-1"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Days List */}
        {!isCollapsed && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {trip.days.map((day) => (
                <DayCard
                  key={day.dayNumber}
                  day={day}
                  isSelected={selectedDay === day.dayNumber}
                />
              ))}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear this trip? This cannot be undone.')) {
                    clearTrip();
                  }
                }}
                className="w-full text-sm text-red-600 hover:text-red-700 hover:bg-red-50 py-2 px-3 rounded-md transition-colors"
              >
                Clear Trip
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile Bottom Sheet */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-h-64 overflow-y-auto z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-900">{trip.name}</h2>
              <p className="text-xs text-gray-500">{formatDateRange()}</p>
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear this trip?')) {
                  clearTrip();
                }
              }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear
            </button>
          </div>

          <div className="space-y-2">
            {trip.days.map((day) => (
              <DayCard
                key={day.dayNumber}
                day={day}
                isSelected={selectedDay === day.dayNumber}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
