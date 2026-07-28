/**
 * Production mobile analytics — installs, engagement, funnels, AI usage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { env, featureFlags } from '@/constants/env';

const INSTALL_KEY = 'dalily.analytics.install_id';
const SESSION_KEY = 'dalily.analytics.session';

type AnalyticsEvent =
  | 'app_install'
  | 'session_start'
  | 'session_end'
  | 'screen_view'
  | 'screen_performance'
  | 'booking_funnel'
  | 'booking_conversion'
  | 'provider_activity'
  | 'notification_open'
  | 'search_usage'
  | 'ai_feature_usage'
  | 'retention_ping';

type QueuedEvent = {
  name: AnalyticsEvent;
  at: number;
  props: Record<string, unknown>;
};

const queue: QueuedEvent[] = [];
let sessionStartedAt = 0;

function emit(name: string, props: Record<string, unknown>): void {
  if (env.isDev) {
    console.log(`[dalily:analytics_${name}]`, props);
  }
}

async function getInstallId(): Promise<string> {
  let id = await AsyncStorage.getItem(INSTALL_KEY);
  if (!id) {
    id = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(INSTALL_KEY, id);
    track('app_install', { installId: id });
  }
  return id;
}

export function track(name: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  const evt: QueuedEvent = { name, at: Date.now(), props };
  queue.push(evt);
  if (queue.length > 200) queue.shift();
  if (!featureFlags.analytics && env.appEnv === 'development') {
    emit(name, props);
    return;
  }
  emit(name, props);
  if (env.analyticsKey) {
    // Future: analyticsClient.capture(name, props)
  }
}

export async function startAnalyticsSession(): Promise<void> {
  const installId = await getInstallId();
  sessionStartedAt = Date.now();
  await AsyncStorage.setItem(SESSION_KEY, String(sessionStartedAt));
  track('session_start', { installId, env: env.appEnv });
}

export function endAnalyticsSession(): void {
  const durationMs = sessionStartedAt ? Date.now() - sessionStartedAt : 0;
  track('session_end', { durationMs });
  track('retention_ping', { day: new Date().toISOString().slice(0, 10) });
}

export function trackScreen(route: string, durationMs?: number): void {
  track('screen_view', { route });
  if (durationMs != null) {
    track('screen_performance', { route, durationMs });
  }
}

export function trackBookingFunnel(step: string, props: Record<string, unknown> = {}): void {
  track('booking_funnel', { step, ...props });
}

export function trackBookingConversion(bookingId: string): void {
  track('booking_conversion', { bookingId });
}

export function trackProviderActivity(action: string, props: Record<string, unknown> = {}): void {
  track('provider_activity', { action, ...props });
}

export function trackNotificationOpen(category: string): void {
  track('notification_open', { category });
}

export function trackSearchUsage(query: string, resultCount: number): void {
  track('search_usage', { queryLength: query.length, resultCount });
}

export function trackAiFeatureUsage(feature: string, props: Record<string, unknown> = {}): void {
  track('ai_feature_usage', { feature, ...props });
}

export function getAnalyticsQueue(): QueuedEvent[] {
  return [...queue];
}

export const analyticsCatalog = [
  'installs',
  'DAU',
  'MAU',
  'retention',
  'funnels',
  'booking_conversion',
  'provider_activity',
  'notification_open_rate',
  'screen_performance',
  'session_duration',
  'search_usage',
  'ai_feature_usage',
] as const;
