/**
 * Centralized permission management — request, status, recovery.
 */

import { Platform, Linking } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import type { PermissionKind, PermissionSnapshot, PermissionStatusValue } from './types';
import { trackNative } from './observability';

function mapExpoStatus(
  status: string | undefined,
  canAskAgain = true,
): { status: PermissionStatusValue; canAskAgain: boolean } {
  if (status === 'granted') return { status: 'granted', canAskAgain: true };
  if (status === 'denied') {
    return { status: canAskAgain ? 'denied' : 'blocked', canAskAgain };
  }
  if (status === 'undetermined') return { status: 'undetermined', canAskAgain: true };
  return { status: 'unavailable', canAskAgain: false };
}

export async function getPermissionStatus(kind: PermissionKind): Promise<PermissionSnapshot> {
  const updatedAt = Date.now();
  try {
    switch (kind) {
      case 'camera': {
        const r = await Camera.getCameraPermissionsAsync();
        const mapped = mapExpoStatus(r.status, r.canAskAgain);
        return { kind, ...mapped, updatedAt };
      }
      case 'photos': {
        const r = await ImagePicker.getMediaLibraryPermissionsAsync();
        const mapped = mapExpoStatus(r.status, r.canAskAgain);
        return { kind, ...mapped, updatedAt };
      }
      case 'location': {
        const r = await Location.getForegroundPermissionsAsync();
        const mapped = mapExpoStatus(r.status, r.canAskAgain);
        return { kind, ...mapped, updatedAt };
      }
      case 'locationBackground': {
        const r = await Location.getBackgroundPermissionsAsync();
        const mapped = mapExpoStatus(r.status, r.canAskAgain);
        return { kind, ...mapped, updatedAt };
      }
      case 'notifications': {
        const r = await Notifications.getPermissionsAsync();
        const mapped = mapExpoStatus(r.status, r.canAskAgain);
        return { kind, ...mapped, updatedAt };
      }
      case 'biometrics': {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        return {
          kind,
          status: hardware && enrolled ? 'granted' : hardware ? 'denied' : 'unavailable',
          canAskAgain: false,
          updatedAt,
        };
      }
      case 'storage': {
        // Scoped storage on modern Android/iOS — treat as granted when picker available.
        return { kind, status: 'granted', canAskAgain: true, updatedAt };
      }
      default:
        return { kind, status: 'unavailable', canAskAgain: false, updatedAt };
    }
  } catch {
    return { kind, status: 'unavailable', canAskAgain: false, updatedAt };
  }
}

export async function requestPermission(kind: PermissionKind): Promise<PermissionSnapshot> {
  const updatedAt = Date.now();
  let snapshot: PermissionSnapshot;

  switch (kind) {
    case 'camera': {
      const r = await Camera.requestCameraPermissionsAsync();
      snapshot = { kind, ...mapExpoStatus(r.status, r.canAskAgain), updatedAt };
      break;
    }
    case 'photos': {
      const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
      snapshot = { kind, ...mapExpoStatus(r.status, r.canAskAgain), updatedAt };
      break;
    }
    case 'location': {
      const r = await Location.requestForegroundPermissionsAsync();
      snapshot = { kind, ...mapExpoStatus(r.status, r.canAskAgain), updatedAt };
      break;
    }
    case 'locationBackground': {
      // Preparation — request only after foreground granted.
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        snapshot = {
          kind,
          status: 'denied',
          canAskAgain: fg.canAskAgain,
          updatedAt,
        };
        break;
      }
      const r = await Location.requestBackgroundPermissionsAsync();
      snapshot = { kind, ...mapExpoStatus(r.status, r.canAskAgain), updatedAt };
      break;
    }
    case 'notifications': {
      const r = await Notifications.requestPermissionsAsync();
      snapshot = { kind, ...mapExpoStatus(r.status, r.canAskAgain), updatedAt };
      break;
    }
    case 'biometrics':
    case 'storage':
      snapshot = await getPermissionStatus(kind);
      break;
    default:
      snapshot = { kind, status: 'unavailable', canAskAgain: false, updatedAt };
  }

  trackNative('permission_change', {
    kind,
    status: snapshot.status,
    platform: Platform.OS,
  });
  return snapshot;
}

export async function ensurePermission(kind: PermissionKind): Promise<boolean> {
  const current = await getPermissionStatus(kind);
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const next = await requestPermission(kind);
  return next.status === 'granted';
}

/** Opens OS settings so the user can recover blocked permissions. */
export async function openPermissionSettings(): Promise<void> {
  await Linking.openSettings();
}

export async function getAllPermissionStatuses(): Promise<PermissionSnapshot[]> {
  const kinds: PermissionKind[] = [
    'camera',
    'photos',
    'location',
    'locationBackground',
    'notifications',
    'biometrics',
    'storage',
  ];
  return Promise.all(kinds.map((k) => getPermissionStatus(k)));
}
