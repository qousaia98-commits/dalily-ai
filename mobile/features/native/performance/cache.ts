/**
 * Native performance helpers — compression defaults, lazy loading, battery hints.
 */

export const imagePerformanceDefaults = {
  maxWidth: 1600,
  quality: 0.72,
  galleryThumbWidth: 320,
  lazyBatchSize: 12,
} as const;

export const uploadPerformanceDefaults = {
  maxConcurrent: 2,
  retryBackoffMs: [1000, 3000, 8000],
  wifiPreferred: true,
} as const;

export const locationBatteryPolicy = {
  defaultAccuracy: 'balanced' as const,
  liveAccuracy: 'high' as const,
  distanceIntervalM: 25,
  timeIntervalMs: 5000,
  stopOnBackgroundUnlessJobActive: true,
} as const;

/** Simple in-memory URI cache for decoded thumbs (process lifetime). */
const thumbCache = new Map<string, string>();

export function getCachedThumb(key: string): string | undefined {
  return thumbCache.get(key);
}

export function setCachedThumb(key: string, uri: string): void {
  if (thumbCache.size > 64) {
    const first = thumbCache.keys().next().value;
    if (first) thumbCache.delete(first);
  }
  thumbCache.set(key, uri);
}

export function clearThumbCache(): void {
  thumbCache.clear();
}
