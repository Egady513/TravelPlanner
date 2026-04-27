'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Compass,
  Images,
  MapPinned,
  Mountain,
  PanelRightOpen,
  Route,
  Sparkles,
  Ticket,
  WalletCards,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTrip } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import TripMap from '@/components/Map';
import InspirationBoard from '@/components/InspirationBoard';
import type { Activity, Day, DrivingActivity } from '@/types';

interface LuxuryPlannerShellProps {
  onImport: () => void;
  onDashboard: () => void;
  onScout: () => void;
  onPreferences: () => void;
}

interface DayBrief {
  day: Day;
  drives: DrivingActivity[];
  activities: Activity[];
  destination: string;
  totalDriveHours: number;
  routeStops: number;
}

function formatDate(date?: Date | string) {
  if (!date) return 'Unscheduled';
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Unscheduled';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function formatDriveHours(hours: number) {
  if (hours <= 0) return null;
  return hours % 1 === 0 ? `${hours.toFixed(0)}h` : `${hours.toFixed(1)}h`;
}

function getDayBrief(day: Day): DayBrief {
  const planned = day.activities.filter(activity => !activity.isContinuingStay);
  const drives = planned.filter(activity => activity.type === 'driving') as DrivingActivity[];
  const activities = planned.filter(activity => activity.type !== 'driving');
  const lastDrive = drives[drives.length - 1];
  const destination = lastDrive?.endLocation?.name ?? activities[activities.length - 1]?.name ?? 'Open day';

  return {
    day,
    drives,
    activities,
    destination,
    totalDriveHours: drives.reduce((sum, drive) => sum + (drive.estimatedDriveHours ?? 0), 0),
    routeStops: drives.reduce((sum, drive) => sum + (drive.waypoints?.length ?? 0), 0),
  };
}

function getRouteSuggestionStops(day: Day): Activity[] {
  return day.activities
    .filter(activity => !activity.isContinuingStay)
    .flatMap(activity => {
      if (activity.type !== 'driving') return [activity];
      const drive = activity as DrivingActivity;
      const stops: Activity[] = [];

      if (drive.startLocation?.coordinates) {
        stops.push({
          ...activity,
          id: `${activity.id}-start`,
          type: 'activity',
          name: drive.startLocation.name,
          coordinates: drive.startLocation.coordinates,
        });
      }

      (drive.waypoints ?? []).forEach((waypoint, index) => {
        stops.push({
          ...activity,
          id: `${activity.id}-waypoint-${index}`,
          type: 'scenic',
          name: waypoint.name,
          coordinates: waypoint.coordinates,
        });
      });

      if (drive.endLocation?.coordinates) {
        stops.push({
          ...activity,
          id: `${activity.id}-end`,
          type: 'activity',
          name: drive.endLocation.name,
          coordinates: drive.endLocation.coordinates,
        });
      }

      return stops;
    })
    .filter(activity => Number.isFinite(activity.coordinates?.lat) && Number.isFinite(activity.coordinates?.lng));
}

export default function LuxuryPlannerShell({
  onImport,
  onDashboard,
  onScout,
  onPreferences,
}: LuxuryPlannerShellProps) {
  const { trip, selectedDay, setSelectedDay, isSaving } = useTrip();
  const [showInsights, setShowInsights] = useState(false);
  const [showReadout, setShowReadout] = useState(false);
  const [showInspirationBoard, setShowInspirationBoard] = useState(false);
  const [routeReviewDay, setRouteReviewDay] = useState<Day | null>(null);

  if (!trip) return null;

  const briefs = trip.days.map(getDayBrief);
  if (briefs.length === 0) {
    return (
      <div className="min-h-screen bg-stone-950 p-6 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
            <Compass className="h-6 w-6" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Private itinerary studio</p>
          <h1 className="mt-2 text-3xl font-semibold">{trip.name || 'Road Trip'}</h1>
          <p className="mt-3 text-sm text-stone-300">Add trip days to unlock the map, route planner, and readiness readout.</p>
          <button onClick={onImport} className="mt-6 rounded-md bg-white px-4 py-2 text-sm font-semibold text-stone-950">
            Import plan
          </button>
        </div>
      </div>
    );
  }

  const selectedBrief = briefs.find(brief => brief.day.dayNumber === selectedDay) ?? briefs[0];
  const issueDays = briefs.filter(brief => brief.day.validationStatus.level !== 'success');
  const routeHeavyDays = briefs
    .filter(brief => brief.totalDriveHours >= Math.max(3, trip.maxDrivingHours * 0.65) || brief.routeStops > 0)
    .slice(0, 4);
  const unplannedDays = briefs.filter(brief => brief.day.activities.length === 0);
  const ticketItems = briefs.flatMap(brief =>
    brief.day.activities
      .filter(activity => activity.requiresTickets && !activity.ticketsPurchased)
      .map(activity => ({ activity, dayNumber: brief.day.dayNumber }))
  );
  const totalDriveHours = briefs.reduce((sum, brief) => sum + brief.totalDriveHours, 0);
  const plannedDays = briefs.filter(brief => brief.day.activities.length > 0).length;
  const readinessItems = [
    { label: 'Route suggestions', ready: routeHeavyDays.length > 0, detail: routeHeavyDays.length ? `${routeHeavyDays.length} route days to review` : 'Add drive stops to optimize', action: () => routeHeavyDays[0] ? setRouteReviewDay(routeHeavyDays[0].day) : onScout() },
    { label: 'Reservations', ready: ticketItems.length === 0, detail: ticketItems.length ? `${ticketItems.length} ticket or booking gaps` : 'No ticket gaps found', action: onDashboard },
    { label: 'Idea coverage', ready: unplannedDays.length === 0, detail: `${plannedDays}/${trip.days.length} days have plans`, action: () => setShowInspirationBoard(true) },
    { label: 'Trip risk', ready: issueDays.length === 0, detail: issueDays.length ? `${issueDays.length} days need review` : 'No active warnings', action: () => issueDays[0] ? setSelectedDay(issueDays[0].day.dayNumber) : onDashboard() },
  ];
  const tripStart = formatDate(trip.startDate);
  const tripEnd = formatDate(trip.endDate);

  return (
    <div className="min-h-screen overflow-hidden bg-stone-100 text-stone-950">
      <div className="flex h-screen flex-col">
        <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-stone-950 text-white shadow-sm">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Private itinerary studio</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-lg font-semibold text-stone-950">{trip.name || 'Road Trip'}</h1>
                <span className="text-xs text-stone-500">{tripStart} to {tripEnd}</span>
                {isSaving && <span className="text-xs text-stone-400">Saving...</span>}
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-1 lg:flex">
            <button onClick={() => setShowInspirationBoard(true)} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:text-stone-950">
              <Images className="h-4 w-4 text-rose-700" />
              Ideas
            </button>
            <button onClick={onScout} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950 hover:shadow-sm">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Scout
            </button>
            <button onClick={onPreferences} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950 hover:shadow-sm">
              <Mountain className="h-4 w-4 text-emerald-700" />
              Taste
            </button>
            <button onClick={onDashboard} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950 hover:shadow-sm">
              <WalletCards className="h-4 w-4 text-sky-700" />
              Costs
            </button>
            <button onClick={onImport} className="inline-flex items-center gap-2 rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800">
              <MapPinned className="h-4 w-4" />
              Import
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 bg-[#eee7db]">
          <Sidebar />

          <section className="relative min-w-0 flex-1 overflow-hidden bg-stone-900">
            <div className="absolute inset-0 contrast-[1.03] saturate-[1.08]">
              <TripMap className="h-full w-full" />
            </div>

            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-4 sm:inset-x-5 sm:top-5">
              <div className="pointer-events-auto w-full max-w-md rounded-lg border border-white/80 bg-white/95 p-3 shadow-xl shadow-stone-900/10 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Selected day</p>
                    <h2 className="mt-1 text-lg font-semibold text-stone-950">
                      Day {selectedBrief.day.dayNumber}: {selectedBrief.destination}
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">{formatDate(selectedBrief.day.date)}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDay(selectedBrief.day.dayNumber)}
                    className="rounded-md border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
                  >
                    Focus map
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Metric label="Drive" value={formatDriveHours(selectedBrief.totalDriveHours) ?? 'None'} />
                  <Metric label="Stops" value={String(selectedBrief.routeStops)} />
                  <Metric label="Plans" value={String(selectedBrief.activities.length)} />
                </div>
                <button
                  onClick={() => setRouteReviewDay(selectedBrief.day)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Review stop order
                </button>
              </div>

            </div>

            <div className="pointer-events-auto absolute bottom-5 right-24 z-10 hidden w-72 rounded-lg border border-stone-800 bg-stone-950/95 text-white shadow-xl shadow-stone-900/20 backdrop-blur-xl xl:block">
              <button
                onClick={() => setShowReadout(prev => !prev)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Trip snapshot</span>
                {showReadout ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
              </button>
              <div className={`${showReadout ? 'grid' : 'hidden'} grid-cols-2 gap-3 px-4 pb-4`}>
                <DarkMetric icon={Route} label="Drive time" value={formatDriveHours(totalDriveHours) ?? '0h'} />
                <DarkMetric icon={AlertTriangle} label="Review days" value={String(issueDays.length)} />
                <DarkMetric icon={Ticket} label="Ticket gaps" value={String(ticketItems.length)} />
                <DarkMetric icon={CheckCircle2} label="Planned" value={`${plannedDays}/${trip.days.length}`} />
              </div>
            </div>

            {showInsights ? (
              <aside className="absolute bottom-5 left-5 z-10 hidden max-h-[55vh] w-[22rem] flex-col gap-3 overflow-y-auto xl:flex">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowInsights(false)}
                    className="inline-flex items-center gap-2 rounded-md border border-white/80 bg-white/95 px-3 py-2 text-xs font-semibold text-stone-600 shadow-lg transition hover:bg-stone-50 hover:text-stone-950"
                  >
                    <X className="h-3.5 w-3.5" />
                    Hide insights
                  </button>
                </div>
                <Panel title="Route Planner" kicker="Driving days to review">
                  <div className="space-y-2">
                    {routeHeavyDays.length > 0 ? routeHeavyDays.map(brief => (
                      <button
                        key={brief.day.dayNumber}
                        onClick={() => {
                          setSelectedDay(brief.day.dayNumber);
                          setRouteReviewDay(brief.day);
                        }}
                        className="w-full rounded-md border border-stone-200 bg-white p-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-stone-950">Day {brief.day.dayNumber}: {brief.destination}</p>
                            <p className="mt-0.5 text-xs text-stone-500">{formatDate(brief.day.date)}</p>
                          </div>
                          <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">
                            {formatDriveHours(brief.totalDriveHours) ?? `${brief.routeStops} stops`}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-stone-500">Click for Scout stop-order suggestions and map focus.</p>
                      </button>
                    )) : (
                      <p className="text-sm text-stone-500">Add drive stops or scenic points, then this becomes your route optimization queue.</p>
                    )}
                  </div>
                </Panel>

                <Panel title="Trip Readiness" kicker="Confidence checklist">
                  <div className="space-y-2">
                    {readinessItems.map(item => (
                      <button key={item.label} onClick={item.action} className="flex w-full items-start gap-3 rounded-md border border-stone-200 bg-white p-3 text-left transition hover:border-stone-300 hover:bg-stone-50">
                        {item.ready ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{item.label}</p>
                          <p className="text-xs text-stone-500">{item.detail}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              </aside>
            ) : (
              <button
                onClick={() => setShowInsights(true)}
                className="absolute bottom-24 left-5 z-10 hidden items-center gap-2 rounded-md border border-white/80 bg-white/95 px-3 py-2 text-xs font-semibold text-stone-700 shadow-lg transition hover:bg-stone-50 xl:inline-flex"
              >
                <PanelRightOpen className="h-4 w-4" />
                Route insights
              </button>
            )}
          </section>
        </main>
      </div>
      <InspirationBoard isOpen={showInspirationBoard} onClose={() => setShowInspirationBoard(false)} />
      <RouteReviewModal day={routeReviewDay} trip={trip} onClose={() => setRouteReviewDay(null)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function DarkMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <Icon className="h-4 w-4 text-amber-300" />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Panel({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-auto rounded-lg border border-white/80 bg-white/95 p-4 shadow-2xl shadow-stone-900/10 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{kicker}</p>
      <h3 className="mt-1 text-base font-semibold text-stone-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function RouteReviewModal({
  day,
  trip,
  onClose,
}: {
  day: Day | null;
  trip: NonNullable<ReturnType<typeof useTrip>['trip']>;
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [order, setOrder] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!day) return null;

  const plannedActivities = getRouteSuggestionStops(day);
  const canOptimize = plannedActivities.length >= 2;

  const requestSuggestions = async () => {
    if (!canOptimize || isLoading) return;
    setIsLoading(true);
    setError(null);
    setReasoning(null);
    setOrder([]);

    try {
      const response = await fetch('/api/scout/optimize-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: { ...day, activities: plannedActivities }, trip }),
      });
      if (!response.ok) throw new Error('Could not create route suggestions');
      const data = await response.json() as { order: string[]; reasoning: string };
      const byId = new Map(plannedActivities.map(activity => [activity.id, activity]));
      setOrder(data.order.map(id => byId.get(id)).filter(Boolean) as Activity[]);
      setReasoning(data.reasoning);
    } catch {
      setError('Scout could not create suggestions for this day yet. The day may need more mapped stops or cleaner coordinates.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pointer-events-none">
      <div className="pointer-events-auto max-h-[48vh] w-full max-w-4xl overflow-hidden rounded-xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Scout route suggestions</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-950">Day {day.dayNumber} stop order</h2>
            <p className="mt-1 text-sm text-stone-500">This reviews drive points, waypoints, meals, lodging, and activities so the route advice matches the map.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Close route suggestions">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(48vh-6.5rem)] space-y-4 overflow-y-auto p-4">
          {!canOptimize && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Add at least two mapped stops, waypoints, or activities to get route-order suggestions.</p>
          )}

          <button
            onClick={requestSuggestions}
            disabled={!canOptimize || isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isLoading ? 'Reviewing route...' : 'Generate suggestions'}
          </button>

          {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {reasoning && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{reasoning}</p>}

          {order.length > 0 && (
            <div className="space-y-2">
              {order.map((activity, index) => (
                <div key={activity.id} className="flex items-start gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-white">{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{activity.name}</p>
                    <p className="text-xs capitalize text-stone-500">{activity.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
