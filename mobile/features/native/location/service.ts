import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensurePermission } from '../permissions';
import type { Coordinates, LocationAccuracyLevel } from '../types';
import { trackNative } from '../observability';

const HISTORY_KEY = 'dalily.native.location.history';
const HISTORY_MAX = 50;

const ACCURACY_MAP: Record<LocationAccuracyLevel, Location.LocationAccuracy> = {
  lowest: Location.Accuracy.Lowest,
  balanced: Location.Accuracy.Balanced,
  high: Location.Accuracy.High,
  best: Location.Accuracy.BestForNavigation,
};

export async function getCurrentPosition(
  accuracy: LocationAccuracyLevel = 'balanced',
): Promise<Coordinates> {
  const granted = await ensurePermission('location');
  if (!granted) throw new Error('Location permission required');

  const pos = await Location.getCurrentPositionAsync({
    accuracy: ACCURACY_MAP[accuracy],
  });

  const coords: Coordinates = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
    timestamp: pos.timestamp,
  };

  trackNative('location_accuracy', {
    accuracyMeters: coords.accuracy,
    level: accuracy,
    role: 'current',
  });
  await appendLocationHistory(coords);
  return coords;
}

/** Provider GPS ping — same API, tagged for observability. */
export async function getProviderGps(
  accuracy: LocationAccuracyLevel = 'high',
): Promise<Coordinates> {
  const coords = await getCurrentPosition(accuracy);
  trackNative('location_accuracy', {
    accuracyMeters: coords.accuracy,
    level: accuracy,
    role: 'provider_gps',
  });
  return coords;
}

export async function detectCustomerAddress(): Promise<{
  coords: Coordinates;
  address?: string;
}> {
  const coords = await getCurrentPosition('balanced');
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const p = places[0];
    const address = p
      ? [p.name, p.street, p.city, p.region, p.postalCode].filter(Boolean).join(', ')
      : undefined;
    return { coords, address };
  } catch {
    return { coords };
  }
}

/** Live location permission gate — call before starting watch. */
export async function ensureLiveLocationPermission(): Promise<boolean> {
  return ensurePermission('location');
}

/**
 * Background location preparation — requests background permission when ready.
 * Actual TaskManager watch is wired in a later native build.
 */
export async function prepareBackgroundLocation(): Promise<{
  prepared: boolean;
  status: string;
}> {
  const ok = await ensurePermission('locationBackground');
  trackNative('background_task', {
    feature: 'background_location',
    prepared: ok,
  });
  return { prepared: ok, status: ok ? 'ready' : 'permission_denied' };
}

export async function watchPosition(
  onUpdate: (coords: Coordinates) => void,
  accuracy: LocationAccuracyLevel = 'high',
): Promise<() => void> {
  const granted = await ensureLiveLocationPermission();
  if (!granted) throw new Error('Location permission required');

  const sub = await Location.watchPositionAsync(
    {
      accuracy: ACCURACY_MAP[accuracy],
      distanceInterval: 25,
      timeInterval: 5000,
    },
    (pos) => {
      onUpdate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      });
    },
  );
  return () => sub.remove();
}

async function appendLocationHistory(coords: Coordinates): Promise<void> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  let list: Coordinates[] = [];
  if (raw) {
    try {
      list = JSON.parse(raw) as Coordinates[];
    } catch {
      list = [];
    }
  }
  list.unshift(coords);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
}

/** Location history preparation — local ring buffer only. */
export async function listLocationHistory(): Promise<Coordinates[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Coordinates[];
  } catch {
    return [];
  }
}
