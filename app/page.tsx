'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTrip } from "@/lib/store";
import Homepage from "@/components/Homepage";
import TripWizard from "@/components/TripWizard";
import TripMap from "@/components/Map";
import Sidebar from "@/components/Sidebar";
import { Trip } from '@/types';
import { parseLocalDate } from '@/lib/dateUtils';

export default function Home() {
  const { trip, setTrip } = useTrip();
  const [showWizard, setShowWizard] = useState(false);
  const router = useRouter();

  const handleWizardComplete = (wizardData: any) => {
    // Parse as local dates so 6/2 stays 6/2 (not UTC which can become 6/1)
    const startDate = parseLocalDate(wizardData.startDate);
    const endDate = parseLocalDate(wizardData.endDate);

    // Generate days from date range
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

    // Create trip with wizard data
    const newTrip: Trip = {
      id: crypto.randomUUID(),
      ...wizardData,
      startDate,
      endDate,
      days,
      isLoopTrip: wizardData.isLoopTrip || false,
      peopleCount: wizardData.peopleCount || 2,
      hasDog: wizardData.hasDog || false,
      tripPace: wizardData.tripPace || 'balanced',
      maxDrivingHours: wizardData.maxDrivingHours || 6,
      drivingPreference: wizardData.drivingPreference || 'flexible',
      planningStyle: wizardData.planningStyle || 'help',
      lodgingPreferences: wizardData.lodgingPreferences || [],
      isNewCamper: wizardData.isNewCamper || false,
      budgetStyle: wizardData.budgetStyle || 'midrange',
      splurgeNights: wizardData.splurgeNights || 0,
      mustHaves: wizardData.mustHaves || [],
    };

    setTrip(newTrip);
    setShowWizard(false);
  };

  // If trip exists, show map interface
  if (trip) {
    return (
      <div className="flex flex-col h-screen">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Road Trip Planner</h1>
          <p className="text-sm text-gray-600">Plan your perfect adventure with your dog</p>
        </header>

        <main className="flex-1 flex overflow-hidden">
          <Sidebar />
          <div className="flex-1 relative">
            <TripMap />
          </div>
        </main>
      </div>
    );
  }

  // Otherwise show homepage
  return (
    <>
      <Homepage onStartPlanning={() => setShowWizard(true)} />
      <TripWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
      />
    </>
  );
}
