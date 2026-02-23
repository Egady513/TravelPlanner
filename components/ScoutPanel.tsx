'use client';

import { useState, useRef, useEffect } from 'react';
import { useTrip } from '@/lib/store';
import type { RouteChangePayload } from '@/lib/store';
import { loadScoutMessages } from '@/lib/supabase';
import RouteChangeModal from './RouteChangeModal';

interface ScoutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScoutPanel({ isOpen, onClose }: ScoutPanelProps) {
  const { trip } = useTrip();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<RouteChangePayload | null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const historyLoaded = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
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
              const parsed = JSON.parse(data) as { text?: string; error?: string; type?: string; payload?: RouteChangePayload };
              if (parsed.type === 'route_suggestion' && parsed.payload) {
                setPendingSuggestion(parsed.payload);
                continue;
              }
              const chunk = parsed.text ?? parsed.error ?? '';
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
        }
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

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={onClose} />
      )}

      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
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

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask Scout about your trip..."
              disabled={isStreaming}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50"
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