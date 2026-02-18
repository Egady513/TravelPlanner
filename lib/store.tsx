'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Trip, Activity, WeatherData } from '@/types';
import { storage } from './storage';
import { validateTrip } from './validation';

interface TripContextType {
  trip: Trip | null;
  setTrip: (trip: Trip) => void;
  addActivity: (activity: Activity) => void;
  removeActivity: (activityId: string) => void;
  updateActivity: (activityId: string, updates: Partial<Activity>) => void;
  reorderActivities: (dayNumber: number, activities: Activity[]) => void;
  setDayWeather: (dayNumber: number, weather: WeatherData) => void;
  clearTrip: () => void;
  selectedDay: number | null;
  setSelectedDay: (dayNumber: number | null) => void;
  isSaving: boolean;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trip, setTripState] = useState<Trip | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Debounce timer ref for saves
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trip from Supabase on mount
  useEffect(() => {
    const loadInitialTrip = async () => {
      try {
        const savedTrip = await storage.loadTrip();
        if (savedTrip) {
          setTripState(savedTrip);
          if (savedTrip.days.length > 0) {
            setSelectedDay(1);
          }
        }
      } catch (err) {
        console.error('Failed to load trip on mount:', err);
      }
      setIsInitialized(true);
    };

    loadInitialTrip();
  }, []);

  // Debounced save to Supabase whenever trip changes
  useEffect(() => {
    if (!isInitialized || !trip) return;

    // Clear any pending save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Debounce: save 500ms after last change (avoids hammering DB during rapid edits)
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await storage.saveTrip(trip);
      } catch (err) {
        console.error('Failed to save trip:', err);
      }
      setIsSaving(false);
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [trip, isInitialized]);

  const setTrip = useCallback((newTrip: Trip) => {
    const validatedDays = validateTrip(newTrip);
    const validatedTrip = { ...newTrip, days: validatedDays };
    setTripState(validatedTrip);
    if (validatedTrip.days.length > 0) {
      setSelectedDay(prev => prev ?? 1);
    }
  }, []);

  const addActivity = useCallback((activity: Activity) => {
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

      const tripWithUpdates = { ...prev, days: updatedDays };
      const validatedDays = validateTrip(tripWithUpdates);
      return { ...tripWithUpdates, days: validatedDays };
    });
  }, []);

  const removeActivity = useCallback((activityId: string) => {
    setTripState(prev => {
      if (!prev) return prev;

      const updatedDays = prev.days.map(day => ({
        ...day,
        activities: day.activities.filter(a => a.id !== activityId),
      }));

      const tripWithUpdates = { ...prev, days: updatedDays };
      const validatedDays = validateTrip(tripWithUpdates);
      return { ...tripWithUpdates, days: validatedDays };
    });
  }, []);

  const updateActivity = useCallback((activityId: string, updates: Partial<Activity>) => {
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

      const tripWithUpdates = { ...prev, days: updatedDays };
      const validatedDays = validateTrip(tripWithUpdates);
      return { ...tripWithUpdates, days: validatedDays };
    });
  }, []);

  const reorderActivities = useCallback((dayNumber: number, activities: Activity[]) => {
    setTripState(prev => {
      if (!prev) return prev;

      const updatedDays = prev.days.map(day =>
        day.dayNumber === dayNumber
          ? { ...day, activities }
          : day
      );

      const tripWithUpdates = { ...prev, days: updatedDays };
      const validatedDays = validateTrip(tripWithUpdates);
      return { ...tripWithUpdates, days: validatedDays };
    });
  }, []);

  const setDayWeather = useCallback((dayNumber: number, weather: WeatherData) => {
    setTripState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(d =>
          d.dayNumber === dayNumber ? { ...d, weather } : d
        ),
      };
    });
  }, []);

  const clearTrip = useCallback(() => {
    setTripState(null);
    setSelectedDay(null);
  }, []);

  return (
    <TripContext.Provider
      value={{
        trip,
        setTrip,
        addActivity,
        removeActivity,
        updateActivity,
        reorderActivities,
        setDayWeather,
        clearTrip,
        selectedDay,
        setSelectedDay,
        isSaving,
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
