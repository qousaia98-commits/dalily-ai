/**
 * Protect media, documents, GPS snapshots, biometric sessions, offline storage.
 */

import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import type { Coordinates } from '../types';

const GPS_VAULT = 'dalily.native.gps.vault';
const MEDIA_INDEX = 'dalily.native.media.index';

export async function vaultGpsSnapshot(coords: Coordinates): Promise<void> {
  await SecureStore.setItemAsync(
    GPS_VAULT,
    JSON.stringify({
      latitude: Number(coords.latitude.toFixed(5)),
      longitude: Number(coords.longitude.toFixed(5)),
      accuracy: coords.accuracy,
      at: coords.timestamp,
    }),
  );
}

export async function readVaultedGps(): Promise<Coordinates | null> {
  const raw = await SecureStore.getItemAsync(GPS_VAULT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Coordinates;
  } catch {
    return null;
  }
}

export async function clearVaultedGps(): Promise<void> {
  await SecureStore.deleteItemAsync(GPS_VAULT);
}

/** Index of sensitive local media URIs (not the bytes). */
export async function registerSensitiveMedia(uri: string): Promise<void> {
  const raw = await SecureStore.getItemAsync(MEDIA_INDEX);
  const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  if (!list.includes(uri)) list.push(uri);
  await SecureStore.setItemAsync(MEDIA_INDEX, JSON.stringify(list.slice(-100)));
}

export async function wipeSensitiveMediaCopies(): Promise<number> {
  const raw = await SecureStore.getItemAsync(MEDIA_INDEX);
  const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  let wiped = 0;
  for (const uri of list) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        wiped += 1;
      }
    } catch {
      /* ignore */
    }
  }
  await SecureStore.deleteItemAsync(MEDIA_INDEX);
  return wiped;
}

export const mediaSecurityPolicy = {
  storeGpsInSecureStore: true,
  compressBeforeUpload: true,
  stripExifOnPick: true,
  offlineQueueEncryptedAtRest: false,
  note: 'Enable encrypted-at-rest for offline queue before production hard launch.',
} as const;
