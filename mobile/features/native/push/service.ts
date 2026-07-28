/**
 * Push notification infrastructure — FCM / APNs ready via Expo Notifications.
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { featureFlags } from '@/constants/env';
import { ensurePermission } from '../permissions';
import { appendNotification } from './history';
import { isCategoryEnabled, loadPushPreferences } from './preferences';
import { navigateFromNotification } from './deep-links';
import type { NativeNotification, PushCategory } from '../types';
import { trackNative } from '../observability';
import { trackNotificationOpen } from '@/lib/analytics';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data ?? {};
    const silent = Boolean(data.silent);
    const category = (data.category as PushCategory | undefined) ?? 'system';
    const prefs = await loadPushPreferences();
    const allowed = isCategoryEnabled(prefs, category);

    return {
      shouldShowAlert: allowed && !silent,
      shouldPlaySound: allowed && !silent,
      shouldSetBadge: allowed && !silent,
      shouldShowBanner: allowed && !silent,
      shouldShowList: allowed && !silent,
    };
  },
});

export type PushRegistration = {
  token: string | null;
  platform: 'ios' | 'android' | 'web' | string;
  provider: 'apns' | 'fcm' | 'expo' | 'unavailable';
  projectId?: string;
};

function inferProvider(): PushRegistration['provider'] {
  if (Platform.OS === 'ios') return 'apns';
  if (Platform.OS === 'android') return 'fcm';
  return 'expo';
}

export async function registerForPushNotifications(): Promise<PushRegistration> {
  if (!featureFlags.pushPrep && !featureFlags.nativePush) {
    return { token: null, platform: Platform.OS, provider: 'unavailable' };
  }

  if (!Device.isDevice) {
    return { token: null, platform: Platform.OS, provider: 'unavailable' };
  }

  const granted = await ensurePermission('notifications');
  if (!granted) {
    return { token: null, platform: Platform.OS, provider: 'unavailable' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dalily-default', {
      name: 'Dalily',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('dalily-silent', {
      name: 'Dalily Silent',
      importance: Notifications.AndroidImportance.MIN,
      sound: undefined,
    });
  }

  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    trackNative('notification_delivery', {
      phase: 'register',
      provider: inferProvider(),
      hasToken: Boolean(tokenResult.data),
    });
    return {
      token: tokenResult.data,
      platform: Platform.OS,
      provider: inferProvider(),
      projectId,
    };
  } catch (error) {
    trackNative('notification_delivery', {
      phase: 'register_error',
      message: error instanceof Error ? error.message : String(error),
    });
    return { token: null, platform: Platform.OS, provider: inferProvider(), projectId };
  }
}

export function parseIncomingNotification(
  content: Notifications.NotificationContent,
): Omit<NativeNotification, 'id' | 'receivedAt' | 'read'> {
  const data = (content.data ?? {}) as Record<string, unknown>;
  const category = (data.category as PushCategory | undefined) ?? 'system';
  return {
    category,
    title: content.title ?? 'Dalily',
    body: content.body ?? '',
    deepLink: typeof data.deepLink === 'string' ? data.deepLink : undefined,
    silent: Boolean(data.silent),
    data,
  };
}

export async function handleIncomingNotification(
  notification: Notifications.Notification,
): Promise<NativeNotification> {
  const parsed = parseIncomingNotification(notification.request.content);
  const entry = await appendNotification(parsed);
  trackNative('notification_delivery', {
    phase: 'received',
    category: entry.category,
    silent: entry.silent ?? false,
  });
  return entry;
}

export function attachPushListeners(): () => void {
  const received = Notifications.addNotificationReceivedListener((n) => {
    void handleIncomingNotification(n);
  });
  const response = Notifications.addNotificationResponseReceivedListener((r) => {
    const parsed = parseIncomingNotification(r.notification.request.content);
    void appendNotification(parsed).then((entry) => {
      trackNative('notification_delivery', { phase: 'opened', category: entry.category });
      trackNotificationOpen(entry.category);
      navigateFromNotification(entry);
    });
  });
  return () => {
    received.remove();
    response.remove();
  };
}

/** Schedule a local notification (dev / fallback / silent sync cue). */
export async function scheduleLocalNotification(input: {
  title: string;
  body: string;
  category: PushCategory;
  deepLink?: string;
  silent?: boolean;
  seconds?: number;
}): Promise<string> {
  const prefs = await loadPushPreferences();
  if (!isCategoryEnabled(prefs, input.category)) {
    return '';
  }
  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      data: {
        category: input.category,
        deepLink: input.deepLink,
        silent: input.silent ?? false,
      },
      sound: input.silent ? undefined : 'default',
    },
    trigger: input.seconds
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: input.seconds }
      : null,
  });
}
