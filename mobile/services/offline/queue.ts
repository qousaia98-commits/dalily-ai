import AsyncStorage from '@react-native-async-storage/async-storage';
import { OFFLINE_QUEUE_MAX } from '@/constants/config';
import { featureFlags } from '@/constants/env';

const QUEUE_KEY = 'dalily.offline.queue';

export type QueuedRequest = {
  id: string;
  path: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
};

export async function enqueueOfflineRequest(
  input: Omit<QueuedRequest, 'id' | 'createdAt'>,
): Promise<void> {
  if (!featureFlags.offlineQueue) return;
  const existing = await listOfflineQueue();
  if (existing.length >= OFFLINE_QUEUE_MAX) {
    existing.shift();
  }
  existing.push({
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
}

export async function listOfflineQueue(): Promise<QueuedRequest[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedRequest[];
  } catch {
    return [];
  }
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Hook point for conflict resolution strategies (last-write-wins, merge, prompt). */
export type ConflictResolutionStrategy = 'last_write_wins' | 'server_wins' | 'manual';

export function resolveConflict<T>(input: {
  local: T;
  remote: T;
  strategy: ConflictResolutionStrategy;
}): T {
  if (input.strategy === 'server_wins') return input.remote;
  return input.local;
}
