import type { MapMarker, TravelEstimate } from '../types';
import { trackNative } from '../observability';

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine travel estimate — replace with Directions API later. */
export function estimateTravel(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): TravelEstimate {
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = EARTH_RADIUS_M * c;
  // Rough urban average ~30 km/h
  const durationSeconds = Math.round((distanceMeters / 30000) * 3600);
  return { distanceMeters, durationSeconds, provider: 'haversine_estimate' };
}

export function formatEta(estimate: TravelEstimate): string {
  const mins = Math.max(1, Math.round(estimate.durationSeconds / 60));
  const km = (estimate.distanceMeters / 1000).toFixed(1);
  return `~${mins} min · ${km} km`;
}

/** Marker clustering preparation — grid bucket helper for large sets. */
export function prepareMarkerClusters(
  markers: MapMarker[],
  cellSizeDeg = 0.02,
): { key: string; markers: MapMarker[]; center: MapMarker['coordinate'] }[] {
  const buckets = new Map<string, MapMarker[]>();
  for (const m of markers) {
    const key = `${Math.floor(m.coordinate.latitude / cellSizeDeg)}_${Math.floor(m.coordinate.longitude / cellSizeDeg)}`;
    const list = buckets.get(key) ?? [];
    list.push(m);
    buckets.set(key, list);
  }
  return [...buckets.entries()].map(([key, group]) => {
    const lat =
      group.reduce((s, m) => s + m.coordinate.latitude, 0) / group.length;
    const lng =
      group.reduce((s, m) => s + m.coordinate.longitude, 0) / group.length;
    return { key, markers: group, center: { latitude: lat, longitude: lng } };
  });
}

/** Offline map preparation — document tile cache strategy (no side effects). */
export const offlineMapPrep = {
  ready: false,
  strategy: 'vector_tile_cache' as const,
  note: 'Wire Mapbox/OSM offline packs in a dedicated native build.',
};

export function logMapInteraction(action: string, payload: Record<string, unknown> = {}): void {
  trackNative('map_interaction', { action, ...payload });
}

export function buildCoveragePolygon(
  center: { latitude: number; longitude: number },
  radiusKm: number,
  points = 32,
): { latitude: number; longitude: number }[] {
  const result: { latitude: number; longitude: number }[] = [];
  const latRad = toRad(center.latitude);
  for (let i = 0; i <= points; i += 1) {
    const bearing = (2 * Math.PI * i) / points;
    const angDist = radiusKm / 6371;
    const lat = Math.asin(
      Math.sin(latRad) * Math.cos(angDist) +
        Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearing),
    );
    const lng =
      toRad(center.longitude) +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angDist) * Math.cos(latRad),
        Math.cos(angDist) - Math.sin(latRad) * Math.sin(lat),
      );
    result.push({
      latitude: (lat * 180) / Math.PI,
      longitude: (lng * 180) / Math.PI,
    });
  }
  return result;
}
