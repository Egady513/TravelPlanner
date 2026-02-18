'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrip } from '@/lib/store';
import { storage } from '@/lib/storage';
import TripWizard from '@/components/TripWizard';
import { Trip } from '@/types';
import { parseLocalDate } from '@/lib/dateUtils';

export default function TripsPage() {
  const { trip, setTrip } = useTrip();
  const [showWizard, setShowWizard] = useState(false);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const router = useRouter();

  // Load all trips on mount and when trip changes
  useEffect(() => {
    const loadTrips = async () => {
      const trips = await storage.getAllTrips();
      setAllTrips(trips);
    };
    loadTrips();
  }, [trip]);

  const handleWizardComplete = (wizardData: Record<string, unknown>) => {
    const startDate = parseLocalDate(wizardData.startDate as string);
    const endDate = parseLocalDate(wizardData.endDate as string);

    const days = [];
    const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    let dayNumber = 1;

    while (currentDate <= endDate) {
      days.push({
        dayNumber,
        date: new Date(currentDate),
        activities: [],
        validationStatus: {
          level: 'success' as const,
          messages: [],
        },
      });
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }

    const newTrip: Trip = {
      id: crypto.randomUUID(),
      name: (wizardData.name as string) || '',
      startDate,
      endDate,
      days,
      isLoopTrip: (wizardData.isLoopTrip as boolean) || false,
      peopleCount: (wizardData.peopleCount as number) || 2,
      hasDog: (wizardData.hasDog as boolean) || false,
      tripPace: (wizardData.tripPace as Trip['tripPace']) || 'balanced',
      maxDrivingHours: (wizardData.maxDrivingHours as number) || 6,
      drivingPreference: (wizardData.drivingPreference as Trip['drivingPreference']) || 'flexible',
      planningStyle: (wizardData.planningStyle as Trip['planningStyle']) || 'help',
      lodgingPreferences: (wizardData.lodgingPreferences as Trip['lodgingPreferences']) || [],
      isNewCamper: (wizardData.isNewCamper as boolean) || false,
      budgetStyle: (wizardData.budgetStyle as Trip['budgetStyle']) || 'midrange',
      splurgeNights: (wizardData.splurgeNights as number) || 0,
      mustHaves: (wizardData.mustHaves as Trip['mustHaves']) || [],
    };

    setTrip(newTrip);
    setShowWizard(false);
    router.push('/');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getTimeUntil = (startDate: Date) => {
    const now = new Date();
    const diff = startDate.getTime() - now.getTime();
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));

    if (months > 0) return `In ${months} ${months === 1 ? 'month' : 'months'}`;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `In ${days} ${days === 1 ? 'day' : 'days'}`;
    if (days === 0) return 'Today';
    return 'Past trip';
  };

  // Use all trips from storage
  const trips = allTrips.length > 0 ? allTrips : (trip ? [trip] : []);

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl">🧭</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Trailhead</span>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                href="/trips"
                className="flex items-center gap-2 text-gray-900 font-semibold"
              >
                <span>🗺️</span>
                <span>My Trips</span>
              </Link>
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
              >
                <span>+</span>
                <span>New Trip</span>
              </button>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Recently viewed and upcoming</h1>
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
            >
              <span>+</span>
              <span>Plan new trip</span>
            </button>
          </div>

          {/* Filter */}
          <div className="mb-6">
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option>Recently viewed</option>
              <option>Upcoming trips</option>
              <option>Past trips</option>
              <option>All trips</option>
            </select>
          </div>

          {/* Trip Cards */}
          {trips.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-5xl">🗺️</span>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No trips yet</h2>
              <p className="text-gray-600 mb-6">Start planning your first adventure!</p>
              <button
                onClick={() => setShowWizard(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
              >
                <span>+</span>
                <span>Plan new trip</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map((tripItem) => (
                <div
                  key={tripItem.id}
                  onClick={() => {
                    setTrip(tripItem);
                    router.push('/');
                  }}
                  className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
                >
                  {/* Trip Image */}
                  <div className="relative h-48 bg-gradient-to-br from-orange-400 to-orange-600">
                    <div className="absolute inset-0 flex items-center justify-center text-white text-6xl">
                      🏔️
                    </div>
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 bg-white text-orange-600 text-sm font-semibold rounded-full">
                        {getTimeUntil(tripItem.startDate)}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 flex gap-2">
                      <button className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors">
                        <span className="text-white">↗</span>
                      </button>
                      <button className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors">
                        <span className="text-white">⋯</span>
                      </button>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">
                      {tripItem.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <span>📅</span>
                      <span>
                        {formatDate(tripItem.startDate)} - {formatDate(tripItem.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>📍 {tripItem.days.reduce((acc, day) => acc + day.activities.length, 0)} places</span>
                      {tripItem.hasDog && <span>🐕</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Trip Wizard */}
      <TripWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
      />
    </>
  );
}
