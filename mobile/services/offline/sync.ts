import * as Network from 'expo-network';
import { apiRequest } from '@/api/client';
import { listOfflineQueue, clearOfflineQueue, type QueuedRequest } from '@/services/offline/queue';
import { useOfflineStore } from '@/store/offline';
import { logEvent } from '@/lib/observability';

export async function refreshNetworkStatus(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    useOfflineStore.getState().setOnline(online);
    return online;
  } catch {
    useOfflineStore.getState().setOnline(true);
    return true;
  }
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const online = await refreshNetworkStatus();
  if (!online) return { synced: 0, failed: 0 };

  const queue = await listOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: QueuedRequest[] = [];

  for (const item of queue) {
    try {
      await apiRequest({
        path: item.path,
        method: item.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        body: item.body,
        headers: item.headers,
        queueIfOffline: false,
        retries: 0,
      });
      synced += 1;
    } catch {
      failed += 1;
      remaining.push(item);
    }
  }

  if (remaining.length === 0) {
    await clearOfflineQueue();
  } else {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('dalily.offline.queue', JSON.stringify(remaining));
  }

  useOfflineStore.getState().setQueueSize(remaining.length);
  logEvent('offline_sync', { synced, failed });
  return { synced, failed };
}
