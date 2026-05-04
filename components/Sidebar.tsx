'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTrip } from '@/lib/store';
import DayCard from './DayCard';
import DayDetailPanel from './DayDetailPanel';
import AddActivityForm from './AddActivityForm';
import ScoutTip from '@/components/ScoutTip';

export default function Sidebar() {
  const { trip, clearTrip, selectedDay, addDay } = useTrip();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [scoutTips, setScoutTips] = useState<Array<{ id: string; tip_key: string; message: string; type: 'warning' | 'info' | 'suggestion'; dismissed: boolean }>>([]);
  useEffect(() => {
    if (!trip) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/scout/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip, tripId: trip.id }),
        });
        const data = await res.json() as { tips?: Array<{ id: string; message: string; type: 'warning' | 'info' | 'suggestion' }> };
        if (data.tips && data.tips.length > 0) {
          setScoutTips(data.tips.map(t => ({ ...t, tip_key: t.id, dismissed: false })));
        }
      } catch {
        // Silent fail
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [trip]);

  const handleDismissTip = async (tipKey: string) => {
    setScoutTips(prev => prev.map(t => t.tip_key === tipKey ? { ...t, dismissed: true } : t));
    try {
      await fetch(`/api/scout/tips/${encodeURIComponent(tipKey)}/dismiss`, { method: 'PATCH' });
    } catch { /* non-fatal */ }
  };

  const visibleTips = scoutTips.filter(t => !t.dismissed);

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
        className={`hidden md:flex flex-col border-r border-gray-200 transition-all duration-300 ${
          isCollapsed ? 'w-12' : 'w-80'
        }`}
        style={{ background: 'linear-gradient(180deg, #f1f5f9 0%, #e8edf5 100%)' }}
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
            {/* Scout Tips */}
            {visibleTips.length > 0 && (
              <div className="px-3 pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                  <span>🐕</span> Scout Tips
                </p>
                {visibleTips.map(tip => (
                  <ScoutTip
                    key={tip.tip_key}
                    id={tip.tip_key}
                    message={tip.message}
                    type={tip.type}
                    onDismiss={handleDismissTip}
                  />
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {trip.days.map((day) => (
                <DayCard
                  key={day.dayNumber}
                  day={day}
                  isSelected={selectedDay === day.dayNumber}
                  onAddActivity={() => setShowAddForm(true)}
                />
              ))}
            </div>
            {/* Add Day button */}
            <div className="px-4 pb-2">
              <button
                onClick={addDay}
                className="w-full text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-2 px-3 rounded-md transition-colors border border-blue-200 border-dashed"
              >
                + Add Day
              </button>
            </div>
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

      {/* Day Detail Modal */}
      {showDetailPanel && selectedDay && (() => {
        const detailDay = trip.days.find(d => d.dayNumber === selectedDay);
        if (!detailDay) return null;
        return (
          <DayDetailPanel
            day={detailDay}
            onClose={() => setShowDetailPanel(false)}
            onAddActivity={() => setShowAddForm(true)}
          />
        );
      })()}

      {/* Add Activity Modal */}
      {showAddForm && selectedDay && typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <AddActivityForm
              coordinates={{ lat: 39.8283, lng: -98.5795 }}
              onClose={() => setShowAddForm(false)}
            />
          </div>,
          document.body
        )
      }

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

          {/* Mobile Add Day button */}
          <div className="mt-3">
            <button
              onClick={addDay}
              className="w-full text-sm text-blue-600 hover:text-blue-700 py-2 px-3 rounded-md border border-blue-200 border-dashed"
            >
              + Add Day
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
