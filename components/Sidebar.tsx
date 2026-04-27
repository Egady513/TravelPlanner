'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTrip } from '@/lib/store';
import DayCard from './DayCard';
import DayDetailPanel from './DayDetailPanel';
import AddActivityForm from './AddActivityForm';
import ScoutTip from '@/components/ScoutTip';
import { ChevronLeft, ChevronRight, Plus, Sparkles, X } from 'lucide-react';

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

  const plannedDays = trip.days.filter(day => day.activities.some(activity => !activity.isContinuingStay)).length;
  const issueDays = trip.days.filter(day => day.validationStatus.level !== 'success').length;

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden min-h-0 flex-shrink-0 md:flex flex-col border-r border-white/70 bg-white/95 shadow-2xl shadow-stone-900/5 backdrop-blur-xl transition-all duration-300 ${
          isCollapsed ? 'w-12' : 'w-96'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 p-4">
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Daily journey board</p>
              <h2 className="mt-1 truncate text-lg font-semibold text-stone-950">{trip.name}</h2>
              <p className="text-xs text-stone-500">{formatDateRange()}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-2 text-stone-600">
                  <strong className="block text-sm text-stone-950">{trip.days.length}</strong>
                  Days
                </span>
                <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-2 text-emerald-800">
                  <strong className="block text-sm text-emerald-950">{plannedDays}</strong>
                  Planned
                </span>
                <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-2 text-amber-800">
                  <strong className="block text-sm text-amber-950">{issueDays}</strong>
                  Review
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-md p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Days List */}
        {!isCollapsed && (
          <>
            {/* Scout Tips */}
            {visibleTips.length > 0 && (
              <div className="px-3 pt-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Concierge Tips
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
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {trip.days.map((day) => (
                <DayCard
                  key={day.dayNumber}
                  day={day}
                  isSelected={selectedDay === day.dayNumber}
                  onOpenDetails={() => setShowDetailPanel(true)}
                />
              ))}
            </div>
            {/* Add Day button */}
            <div className="px-4 pb-2">
              <button
                onClick={addDay}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
              >
                <Plus className="h-4 w-4" />
                Add day
              </button>
            </div>
            <div className="border-t border-stone-200 p-4">
              <button
                onClick={() => {
                  if (confirm('Close this trip view and return home? Your trip stays saved in Supabase.')) {
                    clearTrip();
                  }
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              >
                <X className="h-4 w-4" />
                Close trip view
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50">
            <AddActivityForm
              coordinates={{ lat: 39.8283, lng: -98.5795 }}
              onClose={() => setShowAddForm(false)}
            />
          </div>,
          document.body
        )
      }

      {/* Mobile Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-10 max-h-64 overflow-y-auto border-t border-white/70 bg-white/95 shadow-2xl shadow-stone-900/20 backdrop-blur-xl md:hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-stone-950">{trip.name}</h2>
              <p className="text-xs text-stone-500">{formatDateRange()}</p>
            </div>
            <button
              onClick={() => {
                if (confirm('Close this trip view and return home? Your trip stays saved in Supabase.')) {
                  clearTrip();
                }
              }}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            {trip.days.map((day) => (
              <DayCard
                key={day.dayNumber}
                day={day}
                isSelected={selectedDay === day.dayNumber}
                onOpenDetails={() => setShowDetailPanel(true)}
              />
            ))}
          </div>

          {/* Mobile Add Day button */}
          <div className="mt-3">
            <button
              onClick={addDay}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              <Plus className="h-4 w-4" />
              Add day
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
