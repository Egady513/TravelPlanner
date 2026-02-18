'use client';

import Link from 'next/link';

interface HomepageProps {
  onStartPlanning: () => void;
  onImportPlan?: () => void;
}

export default function Homepage({ onStartPlanning, onImportPlan }: HomepageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">🧭</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Trailhead</span>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              href="/trips"
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium"
            >
              <span>🗺️</span>
              <span>My Trips</span>
            </Link>
            <button
              onClick={onStartPlanning}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              <span>+</span>
              <span>New Trip</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        {/* Tagline */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-orange-200 rounded-full mb-8">
          <span className="text-orange-500">🧭</span>
          <span className="text-gray-700 font-medium">Your safety-first road trip strategist</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-6xl font-bold text-gray-900 mb-6">
          Plan trips that feel{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
            amazing
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
          Don&apos;t overdrive. Don&apos;t overcommit. Build road trips that maximize experience per mile
          while protecting your energy and time.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onStartPlanning}
            className="flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white text-lg font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <span>+</span>
            <span>Start Planning</span>
          </button>
          {onImportPlan && (
            <button
              onClick={onImportPlan}
              className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 text-lg font-semibold rounded-lg transition-colors border-2 border-orange-200"
            >
              <span>📋</span>
              <span>Import Existing Plan</span>
            </button>
          )}
          <Link
            href="/trips"
            className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 text-lg font-semibold rounded-lg transition-colors border-2 border-gray-200"
          >
            <span>View All Trips</span>
            <span>→</span>
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">🐕</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Dog-Friendly</h3>
            <p className="text-sm text-gray-600">Find trails, camping, and stops that welcome your furry friend</p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">⛺</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Smart Planning</h3>
            <p className="text-sm text-gray-600">Balance driving time with experiences for the perfect pace</p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">🌤️</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Weather Ready</h3>
            <p className="text-sm text-gray-600">Integrated forecasts to keep you prepared</p>
          </div>
        </div>
      </main>
    </div>
  );
}
