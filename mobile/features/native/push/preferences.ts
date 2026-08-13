import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PushCategory, PushPreferenceMap } from '../types';

const KEY = 'dalily.native.push.preferences';

export const DEFAULT_PUSH_PREFERENCES: PushPreferenceMap = {
  booking_updates: true,
  provider_job_updates: true,
  messages: true,
  ai_recommendations: true,
  business_assistant_briefings: true,
  promotions: false,
  system: true,
  silent: true,
};

export async function loadPushPreferences(): Promise<PushPreferenceMap> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_PUSH_PREFERENCES };
  try {
    return { ...DEFAULT_PUSH_PREFERENCES, ...(JSON.parse(raw) as PushPreferenceMap) };
  } catch {
    return { ...DEFAULT_PUSH_PREFERENCES };
  }
}

export async function savePushPreferences(prefs: PushPreferenceMap): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}

export async function setPushPreference(
  category: PushCategory,
  enabled: boolean,
): Promise<PushPreferenceMap> {
  const prefs = await loadPushPreferences();
  prefs[category] = enabled;
  await savePushPreferences(prefs);
  return prefs;
}

export function isCategoryEnabled(
  prefs: PushPreferenceMap,
  category: PushCategory,
): boolean {
  return prefs[category] !== false;
}
