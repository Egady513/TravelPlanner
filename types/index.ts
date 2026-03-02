// Core data models for the Road Trip Planner

export type ActivityType = 'trail' | 'hotel' | 'restaurant' | 'camping' | 'park' | 'driving' | 'activity' | 'scenic';

export type LodgingType = 'hotel' | 'camping';

export type TripPace = 'relaxed' | 'balanced' | 'adventure';
export type DrivingPreference = 'early' | 'late' | 'flexible';
export type PlanningStyle = 'help' | 'existing';
export type BudgetStyle = 'budget' | 'midrange';
export type LodgingPreference = 'camping' | 'hotels' | 'airbnb';
export type MustHaveType = 'place' | 'experience' | 'feeling';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Activity {
  id: string;
  type: ActivityType;
  name: string;
  coordinates: Coordinates;
  dayNumber: number;
  isDogFriendly: boolean;
  notes?: string;
  showOnMap?: boolean;  // undefined / true = visible on map, false = hidden
  requiresTickets?: boolean;
  ticketsPurchased?: boolean;
  // Multi-night stay support
  isContinuingStay?: boolean;
  sourceActivityId?: string;
  parentDayNumber?: number;
}

export interface Trail extends Activity {
  type: 'trail';
  difficulty?: 'easy' | 'moderate' | 'strenuous';
  distance?: number; // miles
  elevationGain?: number; // feet
}

export interface Hotel extends Activity {
  type: 'hotel';
  address?: string;
  phone?: string;
  confirmationNumber?: string;
  pricePerNight?: number;
  nights?: number;
}

export interface Restaurant extends Activity {
  type: 'restaurant';
  cuisine?: string;
  openingHours?: string;
}

export interface CampingSpot extends Activity {
  type: 'camping';
  source?: string; // e.g., "OnX Offroad"
  sourceLink?: string;
  amenities: {
    free: boolean;
    fireRing: boolean;
    cellCoverage: boolean;
    water: boolean;
  };
  pricePerNight?: number;
  nights?: number;
}

export interface Park extends Activity {
  type: 'park';
  entranceFee?: number;
  requiresReservation?: boolean;
}

export interface DrivingActivity extends Activity {
  type: 'driving';
  startLocation: {
    name: string;
    coordinates: Coordinates;
  };
  endLocation: {
    name: string;
    coordinates: Coordinates;
  };
  estimatedDriveHours?: number;
  estimatedDriveDistance?: string; // e.g. "143 mi"
}

export interface Day {
  dayNumber: number;
  date?: Date;
  lodging?: LodgingType;
  lodgingActivity?: Hotel | CampingSpot;
  activities: Activity[];
  weather?: WeatherData;
  validationStatus: ValidationStatus;
}

export interface WeatherData {
  date: Date;
  high: number; // Fahrenheit
  low: number; // Fahrenheit
  precipitationChance: number; // 0-100
  description: string;
  shortForecast: string;
}

export type ValidationLevel = 'success' | 'warning' | 'error';

export interface ValidationMessage {
  level: ValidationLevel;
  message: string;
  suggestion?: string;
}

export interface ValidationStatus {
  level: ValidationLevel;
  messages: ValidationMessage[];
}

export interface Location {
  address: string;
  coordinates?: Coordinates;
}

export interface MustHave {
  id: string;
  text: string;
  type: MustHaveType;
}

export interface TripPreferences {
  hiking: number;      // 1-5 (0 = not rated)
  museums: number;     // 1-5
  wineries: number;    // 1-5
  shopping: number;    // 1-5
  restaurants: number; // 1-5
  outdoorAdventure: number; // 1-5
  customInterests: string[]; // e.g., ["crossfit", "craft beer"]
}

export interface Trip {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  days: Day[];
  totalDistance?: number; // miles

  // Step 1: Trip Basics
  startingLocation?: Location;
  endingLocation?: Location;
  isLoopTrip: boolean;

  // Step 2: Who's Going
  peopleCount: number;
  hasDog: boolean;

  // Step 3: Travel Style
  tripPace: TripPace;
  maxDrivingHours: number; // 2-10
  drivingPreference: DrivingPreference;
  planningStyle: PlanningStyle;

  // Step 4: Where You Sleep
  lodgingPreferences: LodgingPreference[];
  isNewCamper: boolean;

  // Step 5: Budget
  budgetStyle: BudgetStyle;
  splurgeNights: number; // 0-5

  // Step 6: Must-Haves
  mustHaves: MustHave[];

  // User interest preferences
  preferences?: TripPreferences;

  // Metadata
  thumbnailUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
