import { CITY_CENTROIDS } from "@/lib/geo/city-centroids";
import { citySlugFromId } from "@/lib/providers/reference";
import type { Database } from "@/types/database.types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

/**
 * Shared coordinate resolution used by search distance + Smart Map.
 * Prefer exact provider coords; fall back to city centroid.
 */
export function resolveProviderCoords(
  row: Pick<ProviderRow, "latitude" | "longitude" | "city_id">,
): { lat: number; lng: number } | null {
  if (
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude)
  ) {
    return { lat: row.latitude, lng: row.longitude };
  }
  const cityKey = citySlugFromId(row.city_id);
  if (cityKey && CITY_CENTROIDS[cityKey]) return CITY_CENTROIDS[cityKey];
  return null;
}
