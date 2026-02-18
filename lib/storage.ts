import { Trip } from '@/types';
import { supabase } from './supabase';

// Convert app Trip object → Supabase row
function tripToRow(trip: Trip): Record<string, unknown> {
  return {
    id: trip.id,
    name: trip.name,
    start_date: trip.startDate.toISOString(),
    end_date: trip.endDate.toISOString(),
    is_loop_trip: trip.isLoopTrip,
    people_count: trip.peopleCount,
    has_dog: trip.hasDog,
    trip_pace: trip.tripPace,
    max_driving_hours: trip.maxDrivingHours,
    driving_preference: trip.drivingPreference,
    planning_style: trip.planningStyle,
    budget_style: trip.budgetStyle,
    splurge_nights: trip.splurgeNights,
    is_new_camper: trip.isNewCamper,
    total_distance: trip.totalDistance ?? null,
    thumbnail_url: trip.thumbnailUrl ?? null,
    starting_location: trip.startingLocation ?? null,
    ending_location: trip.endingLocation ?? null,
    lodging_preferences: trip.lodgingPreferences,
    must_haves: trip.mustHaves,
    days: trip.days.map(day => ({
      ...day,
      date: day.date?.toISOString() ?? null,
    })),
  };
}

// Convert Supabase row → app Trip object
function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    name: row.name as string,
    startDate: new Date(row.start_date as string),
    endDate: new Date(row.end_date as string),
    isLoopTrip: row.is_loop_trip as boolean,
    peopleCount: row.people_count as number,
    hasDog: row.has_dog as boolean,
    tripPace: row.trip_pace as Trip['tripPace'],
    maxDrivingHours: row.max_driving_hours as number,
    drivingPreference: row.driving_preference as Trip['drivingPreference'],
    planningStyle: row.planning_style as Trip['planningStyle'],
    budgetStyle: row.budget_style as Trip['budgetStyle'],
    splurgeNights: row.splurge_nights as number,
    isNewCamper: row.is_new_camper as boolean,
    totalDistance: (row.total_distance ?? undefined) as number | undefined,
    thumbnailUrl: (row.thumbnail_url ?? undefined) as string | undefined,
    startingLocation: (row.starting_location ?? undefined) as Trip['startingLocation'],
    endingLocation: (row.ending_location ?? undefined) as Trip['endingLocation'],
    lodgingPreferences: (row.lodging_preferences ?? []) as Trip['lodgingPreferences'],
    mustHaves: (row.must_haves ?? []) as Trip['mustHaves'],
    days: ((row.days as Record<string, unknown>[]) ?? []).map((day) => ({
      ...day,
      date: day.date ? new Date(day.date as string) : undefined,
    })) as unknown as Trip['days'],
    createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

export const storage = {
  /**
   * Save (upsert) a trip to Supabase
   */
  saveTrip: async (trip: Trip): Promise<void> => {
    const row = tripToRow(trip);
    const { error } = await supabase
      .from('trips')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error('Failed to save trip to Supabase:', error);
      throw error;
    }
  },

  /**
   * Load the most recently updated trip
   */
  loadTrip: async (): Promise<Trip | null> => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // no rows
      console.error('Failed to load trip from Supabase:', error);
      return null;
    }

    return rowToTrip(data);
  },

  /**
   * Get all trips, most recent first
   */
  getAllTrips: async (): Promise<Trip[]> => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to load trips from Supabase:', error);
      return [];
    }

    return (data ?? []).map(rowToTrip);
  },

  /**
   * Get a specific trip by ID
   */
  getTripById: async (id: string): Promise<Trip | null> => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to get trip by ID:', error);
      return null;
    }

    return rowToTrip(data);
  },

  /**
   * Delete a trip by ID
   */
  deleteTrip: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete trip from Supabase:', error);
      throw error;
    }
  },

  /**
   * Check if any trips exist
   */
  hasTrip: async (): Promise<boolean> => {
    const { count, error } = await supabase
      .from('trips')
      .select('id', { count: 'exact', head: true });

    if (error) return false;
    return (count ?? 0) > 0;
  },
};
