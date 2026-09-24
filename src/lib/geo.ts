import * as Location from 'expo-location';

export const DEFAULT_GEOFENCE_RADIUS_METERS = 50;

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 * @returns Distance in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Mean Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Requests high-accuracy current location for attendance validation.
 */
export async function getCurrentAttendanceLocation(): Promise<{
  coords: { latitude: number; longitude: number; accuracy: number | null } | null;
  error: string | null;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        coords: null,
        error: 'Location permission is required to verify you are present in the lecture hall.',
      };
    }

    const isEnabled = await Location.hasServicesEnabledAsync();
    if (!isEnabled) {
      return {
        coords: null,
        error: 'Please enable GPS / Location Services on your device to mark attendance.',
      };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      coords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('Error acquiring GPS location:', err);
    return {
      coords: null,
      error: 'Unable to retrieve your current GPS coordinates. Please check your signal and try again.',
    };
  }
}

/**
 * Validates whether the student's location falls within the lecture hall geofence boundary.
 */
export function validateGeofenceProximity(
  studentLat: number,
  studentLon: number,
  sessionLat?: number | null,
  sessionLon?: number | null,
  allowedRadius = DEFAULT_GEOFENCE_RADIUS_METERS
): {
  isWithin: boolean;
  distance: number;
  message: string;
} {
  // If session coordinates were not set (e.g. online/remote lecture), allow check-in
  if (sessionLat == null || sessionLon == null) {
    return {
      isWithin: true,
      distance: 0,
      message: 'No geofence restriction set for this session.',
    };
  }

  const distance = calculateHaversineDistance(studentLat, studentLon, sessionLat, sessionLon);
  const rounded = Math.round(distance);

  if (distance <= allowedRadius) {
    return {
      isWithin: true,
      distance: rounded,
      message: `Location verified within classroom (${rounded}m from lecturer).`,
    };
  }

  return {
    isWithin: false,
    distance: rounded,
    message: `Geofence check failed: You are ${rounded}m away from the lecture hall (Maximum allowed: ${allowedRadius}m).`,
  };
}
