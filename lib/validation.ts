import type {
  Day,
  Trip,
  ValidationLevel,
  ValidationMessage,
  ValidationStatus,
  LodgingType,
  DrivingActivity,
  TripPace,
} from '../types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the lodging type for a day.
 *  Priority: lodgingActivity.type > day.lodging > inferred from activities */
function resolveLodging(day: Day): LodgingType | null {
  if (day.lodgingActivity) {
    const t = day.lodgingActivity.type;
    if (t === 'hotel' || t === 'camping') return t;
  }
  if (day.lodging) return day.lodging;
  for (const act of day.activities) {
    if (act.type === 'camping') return 'camping';
    if (act.type === 'hotel') return 'hotel';
  }
  return null;
}

/** Return the highest-severity level from a list of messages. */
function aggregateLevel(messages: ValidationMessage[]): ValidationLevel {
  if (messages.some((m) => m.level === 'error')) return 'error';
  if (messages.some((m) => m.level === 'warning')) return 'warning';
  return 'success';
}

/** Haversine distance in miles between two coordinates. */
function haversineDistanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** Count consecutive camping nights immediately before the given day. */
function campingStreakBefore(day: Day, allDays: Day[]): number {
  const sorted = [...allDays].sort((a, b) => a.dayNumber - b.dayNumber);
  const idx = sorted.findIndex((d) => d.dayNumber === day.dayNumber);
  if (idx <= 0) return 0;
  let streak = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (resolveLodging(sorted[i]) === 'camping') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Function 1: validateDay
// ---------------------------------------------------------------------------

export function validateDay(
  day: Day,
  nextDay: Day | null,
  allDays: Day[],
  trip: {
    hasDog: boolean;
    isNewCamper: boolean;
    maxDrivingHours: number;
    tripPace: TripPace;
  }
): ValidationStatus {
  const messages: ValidationMessage[] = [];
  const tonightLodging = resolveLodging(day);

  // Rule 1: Dog left at campsite
  if (
    trip.hasDog &&
    tonightLodging === 'camping' &&
    nextDay !== null &&
    nextDay.activities.some((a) => a.isDogFriendly === false)
  ) {
    messages.push({
      level: 'error',
      message: "Dog can't be left at campsite",
      suggestion: "Consider a hotel near tomorrow's activity",
    });
  }

  // Rule 2: Rain + camping
  if (
    tonightLodging === 'camping' &&
    day.weather !== undefined &&
    day.weather.precipitationChance >= 70
  ) {
    const precipChance = day.weather.precipitationChance;
    messages.push({
      level: 'warning',
      message: 'Rain likely (' + precipChance + '%) - camping may be miserable',
      suggestion: 'Consider hotel as backup',
    });
  }

  // Rule 3: Camping fatigue (3+ consecutive nights before a trail day)
  const streak = campingStreakBefore(day, allDays);
  if (
    streak >= 3 &&
    nextDay !== null &&
    nextDay.activities.some((a) => a.type === 'trail')
  ) {
    messages.push({
      level: 'warning',
      message: streak + ' nights camping - rest day recommended',
      suggestion: 'Consider a hotel to recharge',
    });
  }

  // Rule 4: New camper + cold night
  if (
    trip.isNewCamper &&
    tonightLodging === 'camping' &&
    day.weather !== undefined &&
    day.weather.low < 40
  ) {
    const low = day.weather.low;
    messages.push({
      level: 'warning',
      message: 'Cold night ahead (' + low + '°F) - new campers may struggle',
      suggestion: 'Check your sleeping bag rating',
    });
  }

  // Rule 5: maxDrivingHours exceeded on a driving activity
  for (const act of day.activities) {
    if (act.type === 'driving') {
      const drive = act as DrivingActivity;
      if (drive.estimatedDriveHours !== undefined && drive.estimatedDriveHours > trip.maxDrivingHours) {
        messages.push({
          level: 'warning',
          message: `Driving ${drive.estimatedDriveHours}h exceeds your ${trip.maxDrivingHours}h daily limit`,
          suggestion: 'Break the drive into two days or adjust your max driving hours preference',
        });
      }
    }
  }

  // Rule 6: hasDog + non-dog-friendly activity on same day
  if (trip.hasDog) {
    const nonDogActs = day.activities.filter(a => a.isDogFriendly === false);
    for (const act of nonDogActs) {
      messages.push({
        level: 'error',
        message: `"${act.name}" is not dog-friendly`,
        suggestion: 'Arrange care for your dog while at this activity',
      });
    }
  }

  // Rule 7: relaxed pace but too many activities
  if (trip.tripPace === 'relaxed' && day.activities.length > 3) {
    messages.push({
      level: 'warning',
      message: `${day.activities.length} activities planned — a lot for a relaxed pace`,
      suggestion: 'Consider moving some activities to adjacent days',
    });
  }

  // Rule 8: geographically impossible same-day activities (non-driving, >150 miles apart)
  const geoActivities = day.activities.filter(a => a.type !== 'driving');
  for (let i = 0; i < geoActivities.length; i++) {
    for (let j = i + 1; j < geoActivities.length; j++) {
      const dist = haversineDistanceMiles(
        geoActivities[i].coordinates,
        geoActivities[j].coordinates
      );
      if (dist > 150) {
        messages.push({
          level: 'warning',
          message: `"${geoActivities[i].name}" and "${geoActivities[j].name}" are ~${Math.round(dist)} miles apart`,
          suggestion: 'These may not be feasible in one day — consider splitting across days',
        });
      }
    }
  }

  if (messages.length === 0) {
    return {
      level: 'success',
      messages: [{ level: 'success', message: 'Plan looks good!' }],
    };
  }

  return {
    level: aggregateLevel(messages),
    messages,
  };
}

// ---------------------------------------------------------------------------
// Function 2: validateTrip
// ---------------------------------------------------------------------------

export function validateTrip(trip: Trip): Day[] {
  const sorted = [...trip.days].sort((a, b) => a.dayNumber - b.dayNumber);
  return sorted.map((day, idx) => {
    const nextDay = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const validationStatus = validateDay(day, nextDay, sorted, {
      hasDog: trip.hasDog,
      isNewCamper: trip.isNewCamper,
      maxDrivingHours: trip.maxDrivingHours,
      tripPace: trip.tripPace,
    });
    return { ...day, validationStatus };
  });
}

// ---------------------------------------------------------------------------
// Function 3: getValidationColor
// ---------------------------------------------------------------------------

export function getValidationColor(level: ValidationLevel): string {
  switch (level) {
    case 'error':
      return 'border-red-500 bg-red-50';
    case 'warning':
      return 'border-yellow-500 bg-yellow-50';
    case 'success':
      return 'border-green-500 bg-green-50';
  }
}

// ---------------------------------------------------------------------------
// Function 4: getValidationEmoji
// ---------------------------------------------------------------------------

export function getValidationEmoji(level: ValidationLevel): string {
  switch (level) {
    case 'error':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'success':
      return '🟢';
  }
}
