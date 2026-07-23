import type { CategorySlug } from "@/lib/categories/types";
import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";
import type { NearbyRadiusKm } from "@/lib/geo/distance";

/**
 * Adaptive search radius — users never configure this manually.
 * Values are product policy keyed by problem / category.
 */
const PROBLEM_RADIUS_KM: Partial<Record<ProblemId, number>> = {
  water_leak: 18,
  power_outage: 15,
  ac_not_cooling: 12,
  locked_out: 10,
  appliance_leak: 15,
  medical_need: 8,
  dental_need: 6,
  pharmacy_need: 5,
  legal_need: 25,
  vehicle_repair: 15,
  cleaning_need: 8,
  tutoring_need: 10,
  restaurant_need: 3,
  it_support_need: 12,
  photography_need: 50,
};

const CATEGORY_RADIUS_KM: Partial<Record<string, number>> = {
  plumbing: 18,
  electrical: 12,
  hvac: 12,
  locksmith: 10,
  appliance_repair: 15,
  cleaning: 8,
  salon: 3,
  barber: 3,
  hairdresser: 3,
  restaurant: 3,
  catering: 15,
  photography: 50,
  wedding: 50,
  tutoring: 10,
  medical: 8,
  dental: 6,
  pharmacy: 5,
  legal: 25,
  auto_repair: 15,
};

const PRIORITY_RADIUS_BOOST: Record<ProblemPriority, number> = {
  emergency: 1.25,
  high: 1.1,
  normal: 1,
  low: 0.9,
};

export function resolveDynamicRadiusKm(input: {
  problemId?: ProblemId | null;
  categorySlug?: CategorySlug | string | null;
  priority?: ProblemPriority | null;
}): NearbyRadiusKm {
  let base =
    (input.problemId ? PROBLEM_RADIUS_KM[input.problemId] : undefined) ??
    (input.categorySlug ? CATEGORY_RADIUS_KM[input.categorySlug] : undefined) ??
    10;

  const boost = input.priority ? PRIORITY_RADIUS_BOOST[input.priority] : 1;
  const km = Math.round(base * boost);

  // Clamp to a sensible local range; photographer/wedding can stay large.
  if (km >= 40) return Math.min(km, 50);
  if (km <= 3) return 3;
  return km;
}
