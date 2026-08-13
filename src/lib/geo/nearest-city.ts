import { CITY_CENTROIDS } from "@/lib/geo/city-centroids";
import { haversineKm } from "@/lib/geo/distance";

/** Nearest known city slug from approximate GPS (centroids only — never stores coords). */
export function nearestCitySlugFromCoords(
  lat: number,
  lng: number,
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let bestSlug: string | null = null;
  let bestKm = Number.POSITIVE_INFINITY;

  for (const [slug, centroid] of Object.entries(CITY_CENTROIDS)) {
    const km = haversineKm(lat, lng, centroid.lat, centroid.lng);
    if (km < bestKm) {
      bestKm = km;
      bestSlug = slug;
    }
  }

  return bestSlug;
}
