import { router } from 'expo-router';
import type { NativeNotification, PushCategory } from '../types';

/**
 * Maps notification payload → in-app route (deep link navigation).
 */
export function resolveNotificationDeepLink(
  notification: Pick<NativeNotification, 'category' | 'deepLink' | 'data'>,
): string | null {
  if (notification.deepLink) return notification.deepLink;

  const data = notification.data ?? {};
  const bookingId = typeof data.bookingId === 'string' ? data.bookingId : null;
  const jobId = typeof data.jobId === 'string' ? data.jobId : null;
  const providerId = typeof data.providerId === 'string' ? data.providerId : null;

  switch (notification.category as PushCategory) {
    case 'booking_updates':
      return bookingId ? `/(customer)/bookings/${bookingId}` : '/(customer)/(tabs)/bookings';
    case 'provider_job_updates':
      return jobId ? `/(provider)/jobs/${jobId}` : '/(provider)/(tabs)/jobs';
    case 'messages':
      return '/(provider)/(tabs)/messages';
    case 'ai_recommendations':
      return '/(customer)/(tabs)';
    case 'business_assistant_briefings':
      return '/(provider)/assistant';
    case 'promotions':
      return providerId ? `/(customer)/providers/${providerId}` : '/(customer)/(tabs)';
    case 'system':
      return '/(customer)/notifications';
    case 'silent':
      return null;
    default:
      return null;
  }
}

export function navigateFromNotification(
  notification: Pick<NativeNotification, 'category' | 'deepLink' | 'data'>,
): void {
  const href = resolveNotificationDeepLink(notification);
  if (href) router.push(href as never);
}
