'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Plus, Search, Sparkles, X } from 'lucide-react';
import { useTrip } from '@/lib/store';
import type { Activity, ActivityType } from '@/types';

interface InspirationBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LooseIdea {
  id: string;
  title: string;
  note: string;
  vibe: string;
}

const typeLabels: Record<ActivityType, string> = {
  trail: 'Trail',
  hotel: 'Stay',
  restaurant: 'Food',
  camping: 'Camp',
  park: 'Park',
  driving: 'Drive',
  activity: 'Experience',
  scenic: 'Scenic',
};

const typeImages: Record<ActivityType, string> = {
  trail: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  hotel: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
  restaurant: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
  camping: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80',
  park: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80',
  driving: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
  activity: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=900&q=80',
  scenic: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
};

const vibeOptions = ['Worth it', 'Maybe', 'Splurge', 'Rainy day', 'Food', 'Photo stop'];

export default function InspirationBoard({ isOpen, onClose }: InspirationBoardProps) {
  const { trip } = useTrip();
  const [ideas, setIdeas] = useState<LooseIdea[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [vibe, setVibe] = useState(vibeOptions[0]);
  const [query, setQuery] = useState('');

  const storageKey = trip ? `travel-planner:idea-board:${trip.id}` : null;

  useEffect(() => {
    if (!isOpen || !storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setIdeas(raw ? JSON.parse(raw) as LooseIdea[] : []);
    } catch {
      setIdeas([]);
    }
  }, [isOpen, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(ideas));
  }, [ideas, storageKey]);

  const itineraryCards = useMemo(() => {
    if (!trip) return [];
    return trip.days.flatMap(day =>
      (day.activities ?? [])
        .filter(activity => !activity.isContinuingStay && activity.type !== 'driving')
        .map(activity => ({ activity, dayNumber: day.dayNumber }))
    );
  }, [trip]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredActivities = itineraryCards.filter(({ activity }) =>
    !normalizedQuery ||
    activity.name.toLowerCase().includes(normalizedQuery) ||
    typeLabels[activity.type].toLowerCase().includes(normalizedQuery) ||
    activity.notes?.toLowerCase().includes(normalizedQuery)
  );
  const filteredIdeas = ideas.filter(idea =>
    !normalizedQuery ||
    idea.title.toLowerCase().includes(normalizedQuery) ||
    idea.note.toLowerCase().includes(normalizedQuery) ||
    idea.vibe.toLowerCase().includes(normalizedQuery)
  );

  if (!isOpen || !trip) return null;

  const addIdea = () => {
    if (!title.trim()) return;
    setIdeas(prev => [
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        note: note.trim(),
        vibe,
      },
      ...prev,
    ]);
    setTitle('');
    setNote('');
    setVibe(vibeOptions[0]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/45 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-xl border border-white/70 bg-[#f8f4ec] shadow-2xl">
        <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Inspiration board
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-stone-950">Ideas worth considering</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search ideas"
                className="h-10 w-64 rounded-md border border-stone-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-stone-400"
              />
            </div>
            <button onClick={onClose} className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Close inspiration board">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="border-b border-stone-200 bg-white/80 p-4 lg:border-b-0 lg:border-r">
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-semibold text-stone-950">Throw in an idea</h3>
              </div>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Sunset at Lamar Valley"
                className="mt-4 w-full rounded-md border border-stone-200 px-3 py-2 text-sm outline-none transition focus:border-stone-400"
              />
              <textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="Why it might be worth it, timing, links, reservation notes..."
                className="mt-2 min-h-24 w-full resize-none rounded-md border border-stone-200 px-3 py-2 text-sm outline-none transition focus:border-stone-400"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {vibeOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => setVibe(option)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      vibe === option
                        ? 'border-stone-950 bg-stone-950 text-white'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                onClick={addIdea}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                <Plus className="h-4 w-4" />
                Add to board
              </button>
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4">
            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
              {filteredIdeas.map(idea => (
                <LooseIdeaCard key={idea.id} idea={idea} onRemove={() => setIdeas(prev => prev.filter(item => item.id !== idea.id))} />
              ))}
              {filteredActivities.map(({ activity, dayNumber }) => (
                <ActivityIdeaCard key={activity.id} activity={activity} dayNumber={dayNumber} />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function ActivityIdeaCard({ activity, dayNumber }: { activity: Activity; dayNumber: number }) {
  return (
    <article className="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-white/80 bg-white shadow-sm">
      <div
        className="h-44 bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.42)), url(${typeImages[activity.type]})` }}
      >
        <div className="flex h-full flex-col justify-between p-4 text-white">
          <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{typeLabels[activity.type]}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Day {dayNumber}</p>
            <h3 className="mt-1 text-lg font-semibold leading-tight">{activity.name}</h3>
          </div>
        </div>
      </div>
      {activity.notes && <p className="p-4 text-sm leading-6 text-stone-600">{activity.notes}</p>}
    </article>
  );
}

function LooseIdeaCard({ idea, onRemove }: { idea: LooseIdea; onRemove: () => void }) {
  return (
    <article className="mb-4 break-inside-avoid rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{idea.vibe}</span>
        <button onClick={onRemove} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label={`Remove ${idea.title}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-tight text-stone-950">{idea.title}</h3>
      {idea.note && <p className="mt-2 text-sm leading-6 text-stone-600">{idea.note}</p>}
    </article>
  );
}
