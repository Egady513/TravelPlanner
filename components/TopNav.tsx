'use client';

import { ChevronLeft, Upload, BarChart2, Heart } from 'lucide-react';
import { useTrip } from '@/lib/store';

interface TopNavProps {
  onImport: () => void;
  onDashboard: () => void;
  onScout: () => void;
  onPreferences?: () => void;
}

export default function TopNav({ onImport, onDashboard, onScout, onPreferences }: TopNavProps) {
  const { trip, clearTrip, isSaving } = useTrip();

  const handleHome = () => {
    if (confirm('Go back to home? Your trip is saved and can be resumed.')) {
      clearTrip();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={handleHome}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={16} />
          <span>Home</span>
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base leading-tight">{trip?.name ?? 'Road Trip'}</h1>
          {isSaving && <p className="text-xs text-gray-400">Saving…</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onScout}
          className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-orange-50 hover:text-orange-700 transition-colors flex items-center gap-1.5"
          title="Ask Scout"
        >
          🐕 Scout
        </button>
        {onPreferences && (
          <button
            onClick={onPreferences}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Heart size={15} />
            <span>Interests</span>
          </button>
        )}
        <button
          onClick={onImport}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <Upload size={15} />
          <span>Import</span>
        </button>
        <button
          onClick={onDashboard}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <BarChart2 size={15} />
          <span>Dashboard</span>
        </button>
      </div>
    </header>
  );
}
