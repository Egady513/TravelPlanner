import { Trip } from '@/types';

const STORAGE_KEY = 'road-trip-planner-trips';
const ACTIVE_TRIP_KEY = 'road-trip-planner-active-trip';

// Helper function to serialize a trip
const serializeTrip = (trip: Trip) => ({
  ...trip,
  startDate: trip.startDate.toISOString(),
  endDate: trip.endDate.toISOString(),
  createdAt: trip.createdAt?.toISOString(),
  updatedAt: trip.updatedAt?.toISOString(),
  days: trip.days.map(day => ({
    ...day,
    date: day.date?.toISOString(),
  })),
});

// Helper function to deserialize a trip
const deserializeTrip = (data: any): Trip => ({
  ...data,
  startDate: new Date(data.startDate),
  endDate: new Date(data.endDate),
  createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
  updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
  days: data.days.map((day: any) => ({
    ...day,
    date: day.date ? new Date(day.date) : undefined,
  })),
});

export const storage = {
  /**
   * Save trip data to localStorage (supports multiple trips)
   */
  saveTrip: (trip: Trip): void => {
    try {
      // Update timestamps
      const tripToSave = {
        ...trip,
        updatedAt: new Date(),
        createdAt: trip.createdAt || new Date(),
      };

      // Get all trips
      const allTrips = storage.getAllTrips();
      
      // Update or add trip
      const existingIndex = allTrips.findIndex(t => t.id === trip.id);
      if (existingIndex >= 0) {
        allTrips[existingIndex] = tripToSave;
      } else {
        allTrips.push(tripToSave);
      }

      // Save all trips
      const serialized = JSON.stringify(allTrips.map(serializeTrip));
      localStorage.setItem(STORAGE_KEY, serialized);

      // Also save as active trip for backward compatibility
      localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(serializeTrip(tripToSave)));
    } catch (error) {
      console.error('Failed to save trip to localStorage:', error);
    }
  },

  /**
   * Load trip data from localStorage (returns active trip for backward compatibility)
   */
  loadTrip: (): Trip | null => {
    try {
      // Try to load active trip first (for backward compatibility)
      const activeTripSerialized = localStorage.getItem(ACTIVE_TRIP_KEY);
      if (activeTripSerialized) {
        const data = JSON.parse(activeTripSerialized);
        return deserializeTrip(data);
      }

      // Otherwise, get the most recently updated trip
      const allTrips = storage.getAllTrips();
      if (allTrips.length === 0) return null;

      // Return the most recently updated trip
      return allTrips.sort((a, b) => {
        const aTime = a.updatedAt?.getTime() || 0;
        const bTime = b.updatedAt?.getTime() || 0;
        return bTime - aTime;
      })[0];
    } catch (error) {
      console.error('Failed to load trip from localStorage:', error);
      return null;
    }
  },

  /**
   * Get all trips from localStorage
   */
  getAllTrips: (): Trip[] => {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (!serialized) return [];

      const data = JSON.parse(serialized);
      return Array.isArray(data) 
        ? data.map(deserializeTrip)
        : [];
    } catch (error) {
      console.error('Failed to load trips from localStorage:', error);
      return [];
    }
  },

  /**
   * Get a specific trip by ID
   */
  getTripById: (id: string): Trip | null => {
    try {
      const allTrips = storage.getAllTrips();
      return allTrips.find(trip => trip.id === id) || null;
    } catch (error) {
      console.error('Failed to get trip by ID:', error);
      return null;
    }
  },

  /**
   * Delete a trip by ID
   */
  deleteTrip: (id: string): void => {
    try {
      const allTrips = storage.getAllTrips();
      const filtered = allTrips.filter(trip => trip.id !== id);
      const serialized = JSON.stringify(filtered.map(serializeTrip));
      localStorage.setItem(STORAGE_KEY, serialized);

      // If deleting the active trip, clear it
      const activeTrip = localStorage.getItem(ACTIVE_TRIP_KEY);
      if (activeTrip) {
        const activeTripData = JSON.parse(activeTrip);
        if (activeTripData.id === id) {
          localStorage.removeItem(ACTIVE_TRIP_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to delete trip from localStorage:', error);
    }
  },

  /**
   * Clear trip data from localStorage
   */
  clearTrip: (): void => {
    try {
      localStorage.removeItem(ACTIVE_TRIP_KEY);
    } catch (error) {
      console.error('Failed to clear trip from localStorage:', error);
    }
  },

  /**
   * Clear all trips from localStorage
   */
  clearAllTrips: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_TRIP_KEY);
    } catch (error) {
      console.error('Failed to clear all trips from localStorage:', error);
    }
  },

  /**
   * Check if trip data exists in localStorage
   */
  hasTrip: (): boolean => {
    try {
      return storage.getAllTrips().length > 0;
    } catch (error) {
      return false;
    }
  },
};
