/**
 * Offline media upload queue — retry, progress, conflict detection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { featureFlags } from '@/constants/env';
import type { NativeMediaAsset, OfflineMediaUpload } from '../types';
import { trackNative } from '../observability';

const KEY = 'dalily.native.offline.media';
const MAX = 40;

async function readQueue(): Promise<OfflineMediaUpload[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineMediaUpload[];
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineMediaUpload[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

export async function enqueueMediaUpload(input: {
  asset: NativeMediaAsset;
  remotePath: string;
}): Promise<OfflineMediaUpload> {
  if (!featureFlags.offlineQueue && !featureFlags.nativeOfflineMedia) {
    throw new Error('Offline media queue disabled');
  }
  const item: OfflineMediaUpload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    asset: input.asset,
    remotePath: input.remotePath,
    status: 'queued',
    progress: 0,
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const q = await readQueue();
  q.unshift(item);
  await writeQueue(q);
  trackNative('offline_sync', { action: 'enqueue', id: item.id });
  return item;
}

export async function listMediaUploads(): Promise<OfflineMediaUpload[]> {
  return readQueue();
}

export async function removeMediaUpload(id: string): Promise<void> {
  const q = await readQueue();
  await writeQueue(q.filter((i) => i.id !== id));
}

export async function updateMediaUpload(
  id: string,
  patch: Partial<OfflineMediaUpload>,
): Promise<OfflineMediaUpload | null> {
  const q = await readQueue();
  const idx = q.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const current = q[idx]!;
  const next: OfflineMediaUpload = { ...current, ...patch, updatedAt: Date.now() };
  q[idx] = next;
  await writeQueue(q);
  return next;
}

/**
 * Simulated upload processor — replace with Supabase Storage / API.
 * Detects conflicts when remotePath already marked success with different uri.
 */
export async function processMediaUpload(id: string): Promise<OfflineMediaUpload | null> {
  const q = await readQueue();
  const item = q.find((i) => i.id === id);
  if (!item) return null;

  const conflict = q.find(
    (o) =>
      o.id !== id &&
      o.remotePath === item.remotePath &&
      o.status === 'success' &&
      o.asset.uri !== item.asset.uri,
  );
  if (conflict) {
    const updated = await updateMediaUpload(id, {
      status: 'conflict',
      conflictRemoteUri: conflict.asset.uri,
      lastError: 'Remote path already has a different asset',
    });
    trackNative('offline_sync', { action: 'conflict', id });
    return updated;
  }

  await updateMediaUpload(id, { status: 'uploading', progress: 0.2, attempts: item.attempts + 1 });

  // Progress ticks (local simulation for UI)
  await updateMediaUpload(id, { progress: 0.6 });

  try {
    // Hook: await uploadToStorage(item.asset.uri, item.remotePath)
    await new Promise((r) => setTimeout(r, 250));
    const done = await updateMediaUpload(id, {
      status: 'success',
      progress: 1,
      lastError: undefined,
    });
    trackNative('upload_success', { id, purpose: item.asset.purpose });
    return done;
  } catch (error) {
    const failed = await updateMediaUpload(id, {
      status: item.attempts + 1 >= 3 ? 'failed' : 'retrying',
      progress: 0,
      lastError: error instanceof Error ? error.message : String(error),
    });
    trackNative('upload_failure', { id, message: failed?.lastError });
    return failed;
  }
}

export async function retryMediaUpload(id: string): Promise<OfflineMediaUpload | null> {
  await updateMediaUpload(id, { status: 'retrying', progress: 0 });
  return processMediaUpload(id);
}

/** Background sync preparation — flush queued items when online. */
export async function syncOfflineMediaQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  const q = await readQueue();
  const pending = q.filter((i) => i.status === 'queued' || i.status === 'retrying');
  let processed = 0;
  let failed = 0;
  for (const item of pending) {
    const result = await processMediaUpload(item.id);
    if (result?.status === 'success') processed += 1;
    else failed += 1;
  }
  trackNative('offline_sync', { action: 'flush', processed, failed });
  trackNative('background_task', { feature: 'media_sync', processed, failed });
  return { processed, failed };
}
