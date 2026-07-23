/**
 * Haversine distance in kilometers. Never stores GPS — compute only.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number): string {
  if (km < 0.1) return "0.1";
  if (km < 10) return km.toFixed(1);
  return String(Math.round(km));
}

/** Numeric km or entire city. Dynamic radius may use any positive km. */
export type NearbyRadiusKm = number | "city";

export function parseNearbyRadius(value: string | undefined | null): NearbyRadiusKm | null {
  if (!value) return null;
  if (value === "city") return "city";
  const n = Number(value);
  if (Number.isFinite(n) && n > 0 && n <= 100) return n;
  return null;
}

export type SearchSort =
  | "relevant"
  | "nearest"
  | "rating"
  | "newest"
  | "pro"
  | "premium";

export function parseSearchSort(value: string | undefined | null): SearchSort {
  if (
    value === "nearest" ||
    value === "rating" ||
    value === "newest" ||
    value === "pro" ||
    value === "premium"
  ) {
    return value;
  }
  return "relevant";
}
