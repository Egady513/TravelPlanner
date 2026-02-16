'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Trip, Activity, Day } from '@/types';
import { storage } from './storage';

interface TripContextType {
  trip: Trip | null;
  setTrip: (trip: Trip) => void;
  addActivity: (activity: Activity) => void;
  removeActivity: (activityId: string) => void;
  updateActivity: (activityId: string, updates: Partial<Activity>) => void;
  reorderActivities: (dayNumber: number, activities: Activity[]) => void;
  clearTrip: () => void;
  selectedDay: number | null;
  setSelectedDay: (dayNumber: number | null) => void;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trip, setTripState] = useState<Trip | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load trip from localStorage on mount
  useEffect(() => {
    const savedTrip = storage.loadTrip();
    if (savedTrip) {
      setTripState(savedTrip);
      // Auto-select first day
      if (savedTrip.days.length > 0) {
        setSelectedDay(1);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save trip to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized && trip) {
      storage.saveTrip(trip);
    }
  }, [trip, isInitialized]);

  const setTrip = (newTrip: Trip) => {
    setTripState(newTrip);
    // Auto-select first day when creating a new trip
    if (newTrip.days.length > 0 && selectedDay === null) {
      setSelectedDay(1);
    }
  };

  const addActivity = (activity: Activity) => {
    if (!trip) return;

    setTripState(prev => {
      if (!prev) return prev;

      const updatedDays = prev.days.map(day => {
        if (day.dayNumber === activity.dayNumber) {
          return {
            ...day,
            activities: [...day.activities, activity],
          };
        }
        return day;
      });

      return { ...prev, days: updatedDays };
    });
  };

  const removeActivity = (activityId: string) => {
    if (!trip) return;

    setTripState(prev => {
      if (!prev) return prev;

      const updatedDays = prev.days.map(day => ({
        ...day,
        activities: day.activities.filter(a => a.id !== activityId),
      }));

      return { ...prev, days: updatedDays };
    });
  };

  const updateActivity = (activityId: string, updates: Partial<Activity>) => {
    if (!trip) return;

    setTripState(prev => {
      if (!prev) return prev;

      const updatedDays = prev.days.map(day => ({
        ...day,
        activities: day.activities.map(activity =>
          activity.id === activityId
            ? { ...activity, ...updates }
            : activity
        ),
      }));

      return { ...prev, days: updatedDays };
    });
  };

  const reorderActivities = (dayNumber: number, activities: Activity[]) => {
    if (!trip) return;

    setTripState(prev => {
      if (!prev) return prev;

      const updatedDays = prev.days.map(day =>
        day.dayNumber === dayNumber
          ? { ...day, activities }
          : day
      );

      return { ...prev, days: updatedDays };
    });
  };

  const clearTrip = () => {
    setTripState(null);
    setSelectedDay(null);
    storage.clearTrip();
  };

  return (
    <TripContext.Provider
      value={{
        trip,
        setTrip,
        addActivity,
        removeActivity,
        updateActivity,
        reorderActivities,
        clearTrip,
        selectedDay,
        setSelectedDay,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
}
