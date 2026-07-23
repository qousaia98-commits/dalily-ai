import type { PlanSlug } from "@/lib/subscription/types";
import type { ProviderListItem } from "@/types/search.types";
import { getBenefits } from "@/lib/subscription/benefit-engine";

export type MapMarkerKind =
  | "default"
  | "verified"
  | "premium"
  | "featured"
  | "emergency"
  | "selected";

export type SmartMapProvider = {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  planSlug: PlanSlug;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  phone: string | null;
  avatarImage: string;
  href: string;
};

export type UserMapLocation = {
  lat: number;
  lng: number;
};

export type MapTileTheme = "light" | "dark";

/** Estimate travel minutes assuming ~25 km/h urban average (no routing API). */
export function estimateTravelMinutes(distanceKm: number | null | undefined): number | null {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  return Math.max(1, Math.round((distanceKm / 25) * 60));
}

export function resolveMarkerKind(
  provider: Pick<SmartMapProvider, "verified" | "planSlug">,
  options: { selected?: boolean; emergencySearch?: boolean },
): MapMarkerKind {
  if (options.selected) return "selected";
  if (options.emergencySearch) return "emergency";
  const benefits = getBenefits(provider.planSlug);
  if (benefits.canAppearFeatured) return "featured";
  if (benefits.showPremiumSearchAppearance) return "premium";
  if (provider.verified) return "verified";
  return "default";
}

export function toSmartMapProviders(
  items: ProviderListItem[],
  localeName: (item: ProviderListItem) => string,
): SmartMapProvider[] {
  const out: SmartMapProvider[] = [];
  for (const item of items) {
    if (item.latitude == null || item.longitude == null) continue;
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;
    out.push({
      id: item.id,
      name: localeName(item),
      rating: item.rating,
      reviewCount: item.reviewCount,
      verified: item.verified,
      planSlug: item.planSlug ?? "free",
      latitude: item.latitude,
      longitude: item.longitude,
      distanceKm: item.distanceKm ?? null,
      phone: item.phone ?? null,
      avatarImage: item.avatarImage,
      href: `/providers/${item.id}`,
    });
  }
  return out;
}

export const MARKER_COLORS: Record<MapMarkerKind, string> = {
  default: "#1B3A4B",
  verified: "#0F766E",
  premium: "#C4A052",
  featured: "#B45309",
  emergency: "#DC2626",
  selected: "#2563EB",
};
