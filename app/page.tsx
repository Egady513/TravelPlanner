'use client';

import { useState } from 'react';
import { useTrip } from "@/lib/store";
import Homepage from "@/components/Homepage";
import TripWizard from "@/components/TripWizard";
import TripMap from "@/components/Map";
import Sidebar from "@/components/Sidebar";
import { Trip } from '@/types';
import { parseLocalDate } from '@/lib/dateUtils';
import ImportItinerary from "@/components/ImportItinerary";
import TopNav from "@/components/TopNav";
import ScoutPanel from "@/components/ScoutPanel";
import DashboardModal from "@/components/DashboardModal";
import PreferencesModal from "@/components/PreferencesModal";

export default function Home() {
  const { trip, setTrip } = useTrip();
  const [showWizard, setShowWizard] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showScout, setShowScout] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  const handleWizardComplete = (wizardData: Record<string, unknown>) => {
    // Parse as local dates so 6/2 stays 6/2 (not UTC which can become 6/1)
    const startDate = parseLocalDate(wizardData.startDate as string);
    const endDate = parseLocalDate(wizardData.endDate as string);

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
  };

  // If trip exists, show map interface
  if (trip) {
    return (
      <div className="flex flex-col h-screen">
        <TopNav
          onImport={() => setShowImport(true)}
          onDashboard={() => setShowDashboard(true)}
          onScout={() => setShowScout(prev => !prev)}
          onPreferences={() => setShowPreferences(true)}
        />
        <main className="flex-1 flex overflow-hidden">
          <Sidebar />
          <div className="flex-1 relative">
            <TripMap />
          </div>
        </main>
        <ImportItinerary isOpen={showImport} onClose={() => setShowImport(false)} />
        <ScoutPanel isOpen={showScout} onClose={() => setShowScout(false)} />
        {showDashboard && <DashboardModal onClose={() => setShowDashboard(false)} />}
        {showPreferences && <PreferencesModal onClose={() => setShowPreferences(false)} />}
      </div>
    );
  }

  // Otherwise show homepage
  return (
    <>
      <Homepage onStartPlanning={() => setShowWizard(true)} onImportPlan={() => setShowImport(true)} />
      <TripWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
      />
      <ImportItinerary isOpen={showImport} onClose={() => setShowImport(false)} />
    </>
  );
}
