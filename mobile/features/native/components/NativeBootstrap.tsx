import { useEffect } from 'react';
import { featureFlags } from '@/constants/env';
import { attachPushListeners, registerForPushNotifications } from '@/features/native/push/service';
import { syncOfflineMediaQueue } from '@/features/native/offline-media/queue';
import { useOffline } from '@/hooks/useOffline';

/**
 * Bootstraps push listeners + opportunistic offline media sync.
 */
export function NativeBootstrap() {
  const { isOnline } = useOffline();

  useEffect(() => {
    if (!featureFlags.nativeFeatures || !featureFlags.nativePush) return;
    const detach = attachPushListeners();
    void registerForPushNotifications();
    return detach;
  }, []);

  useEffect(() => {
    if (!isOnline || !featureFlags.nativeOfflineMedia) return;
    void syncOfflineMediaQueue();
  }, [isOnline]);

  return null;
}
