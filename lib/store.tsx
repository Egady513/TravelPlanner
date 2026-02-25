'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Trip, Activity, WeatherData, Day } from '@/types';
import { storage } from './storage';
import { validateTrip } from './validation';
import { logRemovedItemToDb, saveScoutAction } from './supabase';

export interface RouteChangePayload {
  affected_day_numbers: number[];
  description: string;
  reason: string;
  new_days: Day[];
  new_end_date: string; // ISO date string
}

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
  logRemovedItem: (itemType: 'activity' | 'day' | 'lodging', name: string, reason?: string) => void;
  applyRouteChange: (payload: RouteChangePayload) => void;
  addDay: () => void;
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
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); }
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try { await storage.saveTrip(trip); } catch (err) {
        console.error('Failed to save trip:', err); }
      setIsSaving(false);
    }, 500);
    return () => { if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); } };
  }, [trip, isInitialized]);

  const setTrip = useCallback((newTrip: Trip) => {
    const validatedDays = validateTrip(newTrip);
    const validatedTrip = { ...newTrip, days: validatedDays };
    setTripState(validatedTrip);
    if (validatedTrip.days.length > 0) { setSelectedDay(prev => prev ?? 1); }
  }, []);

  const addActivity = useCallback((activity: Activity) => {
    setTripState(prev => {
      if (!prev) return prev;
      const isLodging = activity.type === 'hotel' || activity.type === 'camping';
      const nights = isLodging
        ? ((activity as { nights?: number }).nights ?? 1)
        : 1;

      // Build continuing stay copies for multi-night lodging
      const continuingStays: Activity[] = [];
      if (isLodging && nights > 1) {
        for (let n = 1; n < nights; n++) {
          const targetDayNumber = activity.dayNumber + n;
          // Non-contiguous day numbers are silently skipped — fewer copies than nights-1 may be created.
          if (prev.days.some(d => d.dayNumber === targetDayNumber)) {
            continuingStays.push({
              ...activity,
              id: crypto.randomUUID(),
              dayNumber: targetDayNumber,
              isContinuingStay: true,
              sourceActivityId: activity.id,
              parentDayNumber: activity.dayNumber,
            });
          }
        }
      }

      const allToAdd = [activity, ...continuingStays];
      const updatedDays = prev.days.map(day => {
        const toAdd = allToAdd.filter(a => a.dayNumber === day.dayNumber);
        if (toAdd.length === 0) return day;
        return { ...day, activities: [...day.activities, ...toAdd] };
      });
      const tripWithUpdates = { ...prev, days: updatedDays };
      const validatedDays = validateTrip(tripWithUpdates);
      return { ...tripWithUpdates, days: validatedDays };
    });
  }, []);

  const removeActivity = useCallback((activityId: string) => {
    setTripState(prev => {
      if (!prev) return prev;
      // Log the removal before filtering
      const removedActivity = prev.days.flatMap(d => d.activities).find(a => a.id === activityId);
      if (removedActivity && prev.id) {
        logRemovedItemToDb(prev.id, 'activity', removedActivity.name);
      }
      const updatedDays = prev.days.map(day => ({
        ...day, activities: day.activities.filter(a =>
          a.id !== activityId && a.sourceActivityId !== activityId
        ),
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
          activity.id === activityId ? { ...activity, ...updates } : activity
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
        day.dayNumber === dayNumber ? { ...day, activities } : day
      );
      const tripWithUpdates = { ...prev, days: updatedDays };
      const validatedDays = validateTrip(tripWithUpdates);
      return { ...tripWithUpdates, days: validatedDays };
    });
  }, []);

  const setDayWeather = useCallback((dayNumber: number, weather: WeatherData) => {
    setTripState(prev => {
      if (!prev) return prev;
      return { ...prev, days: prev.days.map(d => d.dayNumber === dayNumber ? { ...d, weather } : d) };
    });
  }, []);

  const clearTrip = useCallback(() => {
    setTripState(null);
    setSelectedDay(null);
  }, []);

  const logRemovedItem = useCallback((
    itemType: 'activity' | 'day' | 'lodging',
    name: string,
    reason?: string
  ) => {
    if (!trip?.id) return;
    logRemovedItemToDb(trip.id, itemType, name, reason);
  }, [trip?.id]);

  const applyRouteChange = useCallback((payload: RouteChangePayload) => {
    setTripState(prev => {
      if (!prev) return prev;
      const beforeSnapshot = payload.affected_day_numbers.map(n => prev.days.find(d => d.dayNumber === n));
      const newEndDate = new Date(payload.new_end_date);
      // Normalize Claude's JSON output: date fields arrive as ISO strings, not Date objects
      const normalizedDays = payload.new_days.map(day => ({
        ...day,
        date: day.date
          ? (day.date instanceof Date ? day.date : new Date(day.date as unknown as string))
          : undefined,
      }));
      const updatedTrip = { ...prev, days: normalizedDays, endDate: newEndDate };
      const validatedDays = validateTrip(updatedTrip);
      const finalTrip = { ...updatedTrip, days: validatedDays };
      saveScoutAction(
        prev.id, 'route_change', payload.description, beforeSnapshot, payload.new_days
      ).catch(err => console.error('Failed to save scout action:', err));
      return finalTrip;
    });
  }, []);

  const addDay = useCallback(() => {
    setTripState(prev => {
      if (!prev) return prev;
      const lastDay = prev.days[prev.days.length - 1];
      const newDayNumber = lastDay ? lastDay.dayNumber + 1 : 1;
      const newDate = new Date(prev.startDate);
      newDate.setDate(newDate.getDate() + (newDayNumber - 1));
      const newDay: Day = {
        dayNumber: newDayNumber, date: newDate, activities: [],
        validationStatus: { level: 'success', messages: [] },
      };
      const newEndDate = new Date(prev.endDate);
      newEndDate.setDate(newEndDate.getDate() + 1);
      const updatedTrip = { ...prev, days: [...prev.days, newDay], endDate: newEndDate };
      const validatedDays = validateTrip(updatedTrip);
      return { ...updatedTrip, days: validatedDays };
    });
  }, []);

  return (
    <TripContext.Provider
      value={{
        trip, setTrip, addActivity, removeActivity, updateActivity,
        reorderActivities, setDayWeather, clearTrip,
        selectedDay, setSelectedDay, isSaving,
        logRemovedItem, applyRouteChange, addDay,
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
