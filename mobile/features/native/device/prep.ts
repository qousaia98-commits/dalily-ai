/**
 * Device feature architecture preparation — stubs with clear extension points.
 */

import type { DeviceFeaturePrep } from '../types';
import { trackNative } from '../observability';

export type DeviceFeatureBlueprint = {
  id: DeviceFeaturePrep;
  ready: boolean;
  platform: ('ios' | 'android' | 'both')[];
  moduleHint: string;
  notes: string;
};

export const deviceFeatureBlueprints: DeviceFeatureBlueprint[] = [
  {
    id: 'calendar',
    ready: false,
    platform: ['both'],
    moduleHint: 'expo-calendar',
    notes: 'Sync booking start/end into device calendar with user consent.',
  },
  {
    id: 'contacts',
    ready: false,
    platform: ['both'],
    moduleHint: 'expo-contacts',
    notes: 'Optional import of customer phone for provider outreach — gated.',
  },
  {
    id: 'widgets',
    ready: false,
    platform: ['both'],
    moduleHint: 'expo-widgets / WidgetKit / App Widgets',
    notes: 'Next booking + provider job count home-screen widgets.',
  },
  {
    id: 'live_activities',
    ready: false,
    platform: ['ios'],
    moduleHint: 'ActivityKit + Expo config plugin',
    notes: 'Live job ETA on Lock Screen / Dynamic Island.',
  },
  {
    id: 'android_shortcuts',
    ready: false,
    platform: ['android'],
    moduleHint: 'expo-quick-actions / ShortcutManager',
    notes: 'Long-press: Search, Bookings, New job.',
  },
  {
    id: 'quick_actions',
    ready: false,
    platform: ['ios', 'android'],
    moduleHint: 'expo-quick-actions',
    notes: 'Home-screen quick actions shared across platforms.',
  },
  {
    id: 'background_tasks',
    ready: false,
    platform: ['both'],
    moduleHint: 'expo-task-manager + expo-background-fetch',
    notes: 'Flush offline media + silent push handling.',
  },
];

export function getDeviceFeaturePrep(id: DeviceFeaturePrep): DeviceFeatureBlueprint | undefined {
  return deviceFeatureBlueprints.find((b) => b.id === id);
}

export function markDeviceFeatureInterest(id: DeviceFeaturePrep): void {
  trackNative('background_task', { feature: id, phase: 'prep_interest' });
}
