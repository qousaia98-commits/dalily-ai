import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { estimateTravel, formatEta } from '../maps/utils';
import { trackNative } from '../observability';

export type NavDestination = {
  latitude: number;
  longitude: number;
  label?: string;
  address?: string;
};

/**
 * One-tap navigation — Google Maps, Apple Maps, or platform default.
 */
export async function openInGoogleMaps(dest: NavDestination): Promise<void> {
  const q = dest.label ?? dest.address ?? `${dest.latitude},${dest.longitude}`;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${dest.latitude},${dest.longitude}`,
  )}&destination_place_id=&travelmode=driving&dir_action=navigate`;
  trackNative('navigation_open', { app: 'google', label: q });
  await Linking.openURL(url);
}

export async function openInAppleMaps(dest: NavDestination): Promise<void> {
  const url = `http://maps.apple.com/?daddr=${dest.latitude},${dest.longitude}&dirflg=d`;
  trackNative('navigation_open', { app: 'apple' });
  await Linking.openURL(url);
}

export async function openDefaultNavigation(dest: NavDestination): Promise<void> {
  if (Platform.OS === 'ios') {
    await openInAppleMaps(dest);
  } else {
    await openInGoogleMaps(dest);
  }
}

export async function copyAddress(address: string): Promise<void> {
  await Clipboard.setStringAsync(address);
  trackNative('navigation_open', { action: 'copy_address' });
}

export async function shareLocation(dest: NavDestination): Promise<void> {
  const mapsUrl =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${dest.latitude},${dest.longitude}`
      : `https://www.google.com/maps?q=${dest.latitude},${dest.longitude}`;
  const message = [dest.label, dest.address, mapsUrl].filter(Boolean).join('\n');
  await Share.share({ message });
  trackNative('share_action', { kind: 'location' });
}

export function getEstimatedTravelTime(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): string {
  return formatEta(estimateTravel(from, to));
}
