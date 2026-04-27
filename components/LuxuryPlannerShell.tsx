'use client';

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Compass,
  MapPinned,
  Mountain,
  Route,
  Sparkles,
  Ticket,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTrip } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import TripMap from '@/components/Map';
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

export default function LuxuryPlannerShell({
  onImport,
  onDashboard,
  onScout,
  onPreferences,
}: LuxuryPlannerShellProps) {
  const { trip, selectedDay, setSelectedDay, isSaving } = useTrip();

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
          <p className="mt-3 text-sm text-stone-300">Add trip days to unlock the map, route atelier, and preparedness readout.</p>
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
    { label: 'Route shape', ready: routeHeavyDays.length > 0, detail: `${routeHeavyDays.length} route days surfaced` },
    { label: 'Booked moments', ready: ticketItems.length === 0, detail: ticketItems.length ? `${ticketItems.length} reservations open` : 'No ticket gaps found' },
    { label: 'Plan coverage', ready: unplannedDays.length === 0, detail: `${plannedDays}/${trip.days.length} days planned` },
    { label: 'Trip risk', ready: issueDays.length === 0, detail: issueDays.length ? `${issueDays.length} days need review` : 'No active warnings' },
  ];
  const tripStart = formatDate(trip.startDate);
  const tripEnd = formatDate(trip.endDate);

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f3ec] text-stone-950">
      <div className="flex h-screen flex-col">
        <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-5">
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

          <div className="hidden items-center gap-2 lg:flex">
            <button onClick={onScout} className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Scout
            </button>
            <button onClick={onPreferences} className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50">
              <Mountain className="h-4 w-4 text-emerald-700" />
              Taste profile
            </button>
            <button onClick={onDashboard} className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50">
              <CalendarDays className="h-4 w-4 text-sky-700" />
              Trip health
            </button>
            <button onClick={onImport} className="inline-flex items-center gap-2 rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800">
              <MapPinned className="h-4 w-4" />
              Import plan
            </button>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 bg-[#eee7db] md:grid-cols-[24rem_minmax(0,1fr)]">
          <Sidebar />

          <section className="relative min-w-0 overflow-hidden">
            <div className="absolute inset-0">
              <TripMap />
            </div>

            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-4 sm:inset-x-5 sm:top-5">
              <div className="pointer-events-auto w-full max-w-xl rounded-lg border border-white/70 bg-white/95 p-4 shadow-2xl shadow-stone-900/10 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Today in focus</p>
                    <h2 className="mt-1 text-xl font-semibold text-stone-950">
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
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Metric label="Drive" value={formatDriveHours(selectedBrief.totalDriveHours) ?? 'None'} />
                  <Metric label="Route stops" value={String(selectedBrief.routeStops)} />
                  <Metric label="Ideas saved" value={String(selectedBrief.activities.length)} />
                </div>
              </div>

              <div className="pointer-events-auto hidden w-80 rounded-lg border border-stone-200 bg-stone-950/95 p-4 text-white shadow-2xl shadow-stone-900/20 backdrop-blur-xl xl:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Concierge readout</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <DarkMetric icon={Route} label="Drive time" value={formatDriveHours(totalDriveHours) ?? '0h'} />
                  <DarkMetric icon={AlertTriangle} label="Review days" value={String(issueDays.length)} />
                  <DarkMetric icon={Ticket} label="Ticket gaps" value={String(ticketItems.length)} />
                  <DarkMetric icon={CheckCircle2} label="Planned" value={`${plannedDays}/${trip.days.length}`} />
                </div>
              </div>
            </div>

            <aside className="absolute bottom-5 right-5 top-44 z-10 hidden w-[22rem] flex-col gap-3 xl:flex">
              <Panel title="Route Atelier" kicker="Best next planning moves">
                <div className="space-y-2">
                  {routeHeavyDays.length > 0 ? routeHeavyDays.map(brief => (
                    <button
                      key={brief.day.dayNumber}
                      onClick={() => setSelectedDay(brief.day.dayNumber)}
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
                    </button>
                  )) : (
                    <p className="text-sm text-stone-500">Add a driving segment or scenic route to start shaping the route layer.</p>
                  )}
                </div>
              </Panel>

              <Panel title="Preparedness" kicker="Leave-no-doubt checklist">
                <div className="space-y-2">
                  {readinessItems.map(item => (
                    <div key={item.label} className="flex items-start gap-3 rounded-md border border-stone-200 bg-white p-3">
                      {item.ready ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{item.label}</p>
                        <p className="text-xs text-stone-500">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </aside>
          </section>
        </main>
      </div>
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
