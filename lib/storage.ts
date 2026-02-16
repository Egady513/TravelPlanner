import { Trip } from '@/types';

const STORAGE_KEY = 'road-trip-planner-data';

export const storage = {
  /**
   * Save trip data to localStorage
   */
  saveTrip: (trip: Trip): void => {
    try {
      const serialized = JSON.stringify({
        ...trip,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        days: trip.days.map(day => ({
          ...day,
          date: day.date?.toISOString(),
        })),
      });
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      console.error('Failed to save trip to localStorage:', error);
    }
  },

  /**
   * Load trip data from localStorage
   */
  loadTrip: (): Trip | null => {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (!serialized) return null;

      const data = JSON.parse(serialized);

      // Convert ISO strings back to Date objects
      return {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        days: data.days.map((day: any) => ({
          ...day,
          date: day.date ? new Date(day.date) : undefined,
        })),
      };
    } catch (error) {
      console.error('Failed to load trip from localStorage:', error);
      return null;
    }
  },

  /**
   * Clear trip data from localStorage
   */
  clearTrip: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear trip from localStorage:', error);
    }
  },

  /**
   * Check if trip data exists in localStorage
   */
  hasTrip: (): boolean => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch (error) {
      return false;
    }
  },
};
