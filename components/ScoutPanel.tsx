'use client';

import { useState, useRef, useEffect } from 'react';
import { useTrip } from '@/lib/store';
import type { RouteChangePayload } from '@/lib/store';
import { loadScoutMessages } from '@/lib/supabase';
import { geocodePlace } from '@/lib/geocoding';
import type { Activity, ActivityType, CampingSpot } from '@/types';
import RouteChangeModal from './RouteChangeModal';

interface ScoutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActivitySuggestion {
  dayNumber: number;
  type: ActivityType;
  name: string;
  location: string;
  why: string;
  isDogFriendly: boolean;
}

export default function ScoutPanel({ isOpen, onClose }: ScoutPanelProps) {
  const { trip, addActivity, removeActivity } = useTrip();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<RouteChangePayload | null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);

  const [activitySuggestion, setActivitySuggestion] = useState<ActivitySuggestion | null>(null);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [activityAdded, setActivityAdded] = useState(false);
  const [removeActivitySuggestion, setRemoveActivitySuggestion] = useState<{
    dayNumber: number;
    activityId: string;
    activityName: string;
    reason: string;
  } | null>(null);

  const historyLoaded = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activityAddTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (activityAddTimerRef.current) clearTimeout(activityAddTimerRef.current);
    };
  }, []);

  // Load chat history from Supabase when panel opens (once per session)
  useEffect(() => {
    if (!isOpen || historyLoaded.current || !trip?.id) return;
    loadScoutMessages(trip.id)
      .then(rows => {
        if (rows.length > 0) {
          setMessages(rows.map(r => ({ role: r.role as 'user' | 'assistant', content: r.content })));
        }
        historyLoaded.current = true;
      })
      .catch(() => { historyLoaded.current = true; }); // non-fatal
  }, [isOpen, trip?.id]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const userMessage = { role: 'user' as const, content: inputValue.trim() };
    const outgoingMessages = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = '36px';
    }
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/scout/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: outgoingMessages, tripContext: trip, tripId: trip?.id }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error();
      if (!response.body) throw new Error('Response body is not readable as a stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (separated by \n\n)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data) as { text?: string; error?: string; type?: string; payload?: RouteChangePayload | ActivitySuggestion | { dayNumber: number; activityId: string; activityName: string; reason: string } };
              if (parsed.type === 'route_suggestion' && parsed.payload) {
                setPendingSuggestion(parsed.payload as RouteChangePayload);
                continue;
              }
              if (parsed.type === 'activity_suggestion' && parsed.payload) {
                setActivitySuggestion(parsed.payload as ActivitySuggestion);
                setActivityAdded(false);
                continue;
              }
              if (parsed.type === 'remove_activity' && parsed.payload) {
                setRemoveActivitySuggestion(parsed.payload as { dayNumber: number; activityId: string; activityName: string; reason: string });
                continue;
              }
              if (parsed.error) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: '⚠️ Scout is temporarily unavailable. Please try again in a moment.',
                  };
                  return updated;
                });
                streamError = true;
                break;  // exits inner for-of-lines
              }
              const chunk = parsed.text ?? '';
              if (chunk) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: updated[updated.length - 1].content + chunk,
                  };
                  return updated;
                });
              }
            } catch { /* skip malformed SSE chunks */ }
          }
          if (streamError) break;  // exits outer for-of-parts
        }
        if (streamError) break;  // exits while loop
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('Scout chat error:', err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, I had trouble connecting. Please try again.',
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleAddSuggestedActivity = async () => {
    if (!activitySuggestion || !trip || isAddingActivity) return;
    setIsAddingActivity(true);
    try {
      const coords = await geocodePlace(`${activitySuggestion.name}, ${activitySuggestion.location}`);
      if (!coords) return;
      const activity: Activity = {
        id: crypto.randomUUID(),
        type: activitySuggestion.type,
        name: activitySuggestion.name,
        coordinates: coords,
        dayNumber: activitySuggestion.dayNumber,
        isDogFriendly: activitySuggestion.isDogFriendly,
        notes: activitySuggestion.why,
        ...(activitySuggestion.type === 'camping' ? {
          amenities: { free: false, fireRing: false, cellCoverage: false, water: false },
        } as Partial<CampingSpot> : {}),
      } as Activity;
      addActivity(activity);
      setActivityAdded(true);
      activityAddTimerRef.current = setTimeout(() => { setActivitySuggestion(null); setActivityAdded(false); }, 2000);
    } finally {
      setIsAddingActivity(false);
    }
  };

  return (
    <>
      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full invisible'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-orange-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐕</span>
            <h2 className="font-bold text-gray-900">Scout</h2>
            <span className="text-xs text-gray-500">your trip assistant</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close Scout">✕</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-8">
              <p className="text-2xl mb-2">🐕</p>
              <p>Hi! I&apos;m Scout, your road trip assistant.</p>
              <p className="mt-1">Ask me anything about your trip!</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                {msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Route Suggestion Card */}
        {pendingSuggestion && !showRouteModal && (
          <div className="mx-3 mb-2 border border-orange-200 rounded-lg bg-orange-50 p-3">
            <p className="text-xs font-semibold text-orange-800 mb-1">🗺️ Route Change Available</p>
            <p className="text-xs text-orange-700 mb-2">{pendingSuggestion.description}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowRouteModal(true)}
                className="flex-1 bg-orange-500 text-white text-xs py-1.5 rounded-md hover:bg-orange-600">
                Preview Change
              </button>
              <button onClick={() => setPendingSuggestion(null)}
                className="flex-1 bg-white text-gray-600 text-xs py-1.5 rounded-md border border-gray-300 hover:bg-gray-50">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Activity Suggestion Card */}
        {activitySuggestion && (
          <div className="mx-3 mb-2 border border-green-200 rounded-lg bg-green-50 p-3">
            <p className="text-xs font-semibold text-green-800 mb-0.5">
              ➕ Day {activitySuggestion.dayNumber}: {activitySuggestion.name}
            </p>
            <p className="text-xs text-green-700 mb-2">{activitySuggestion.why}</p>
            <div className="flex gap-2">
              <button
                onClick={handleAddSuggestedActivity}
                disabled={isAddingActivity || activityAdded}
                className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded-md hover:bg-green-700 disabled:opacity-60"
              >
                {activityAdded ? '✓ Added!' : isAddingActivity ? 'Adding…' : `+ Add to Day ${activitySuggestion.dayNumber}`}
              </button>
              <button
                onClick={() => setActivitySuggestion(null)}
                className="flex-1 bg-white text-gray-600 text-xs py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Remove Activity Suggestion Card */}
        {removeActivitySuggestion && (
          <div className="mx-3 mb-2 border border-red-200 rounded-lg bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-800 mb-0.5">
              🗑️ Scout suggests removing:
            </p>
            <p className="text-xs font-medium text-red-900 mb-0.5">{removeActivitySuggestion.activityName}</p>
            <p className="text-xs text-red-700 mb-2">{removeActivitySuggestion.reason}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  removeActivity(removeActivitySuggestion.activityId);
                  setRemoveActivitySuggestion(null);
                }}
                className="flex-1 bg-red-600 text-white text-xs py-1.5 rounded-md hover:bg-red-700"
              >
                Remove
              </button>
              <button
                onClick={() => setRemoveActivitySuggestion(null)}
                className="flex-1 bg-white text-gray-600 text-xs py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value);
                // Auto-grow
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask Scout about your trip… (Shift+Enter for new line)"
              disabled={isStreaming}
              rows={1}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 resize-none overflow-hidden leading-5 min-h-[36px]"
              style={{ height: '36px' }}
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !inputValue.trim()}
              className="bg-orange-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStreaming ? '...' : 'Send'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">Powered by Claude</p>
        </div>
      </div>

      {/* RouteChangeModal rendered outside drawer */}
      {showRouteModal && pendingSuggestion && (
        <RouteChangeModal
          payload={pendingSuggestion}
          onAccept={() => { setShowRouteModal(false); setPendingSuggestion(null); }}
          onDismiss={() => setShowRouteModal(false)}
        />
      )}
    </>
  );
}