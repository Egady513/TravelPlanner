'use client';

import { useState } from 'react';
import { useTrip } from "@/lib/store";
import Homepage from "@/components/Homepage";
import TripWizard from "@/components/TripWizard";
import { Trip } from '@/types';
import { parseLocalDate } from '@/lib/dateUtils';
import ImportItinerary from "@/components/ImportItinerary";
import ScoutPanel from "@/components/ScoutPanel";
import DashboardModal from "@/components/DashboardModal";
import PreferencesModal from "@/components/PreferencesModal";
import LuxuryPlannerShell from "@/components/LuxuryPlannerShell";

export default function Home() {
  const { trip, setTrip, updateDestinationBrief } = useTrip();
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

    // Kick off destination research in the background (non-blocking)
    if (newTrip.days.length > 0) {
      fetch('/api/scout/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip: newTrip }),
      })
        .then(r => r.json() as Promise<{ brief: string }>)
        .then(({ brief }) => { if (brief) updateDestinationBrief(brief); })
        .catch(err => console.error('[research] failed:', err));
    }

    setShowWizard(false);
  };

  // If trip exists, show map interface
  if (trip) {
    return (
      <>
        <LuxuryPlannerShell
          onImport={() => setShowImport(true)}
          onDashboard={() => setShowDashboard(true)}
          onScout={() => setShowScout(prev => !prev)}
          onPreferences={() => setShowPreferences(true)}
        />
        <ImportItinerary isOpen={showImport} onClose={() => setShowImport(false)} />
        <ScoutPanel isOpen={showScout} onClose={() => setShowScout(false)} />
        {showDashboard && <DashboardModal onClose={() => setShowDashboard(false)} />}
        {showPreferences && <PreferencesModal onClose={() => setShowPreferences(false)} />}
      </>
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
