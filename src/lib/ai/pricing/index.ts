/**
 * Pricing module — Sprint 8 Phase 2 AI Dynamic Pricing & Market Intelligence.
 * Catalog ranges remain a seed; live recommendations come from pricing-engine.
 */
import { isAiDynamicPricingEnabled } from "@/lib/config/feature-flags";
import {
  recommendPrice,
  toPublicPriceRecommendation,
  type PublicPriceRecommendation,
} from "@/lib/pricing-engine";

export const pricingModule = {
  id: "pricing",
  status: "sprint8-phase2" as const,
  impl: [
    "src/lib/pricing-engine/",
    "src/lib/ai/jobs/catalog.ts",
  ],
  future: ["weather API", "full ML regressor", "city multipliers live feed"],
};

/**
 * Customer-safe fair market estimate (no internal signal math).
 */
export async function getFairMarketEstimate(input: {
  categoryKey: string;
  regionKey?: string | null;
  distanceKm?: number | null;
  urgency01?: number;
  largeProject?: boolean;
  catalogMin?: number;
  catalogTypical?: number;
  catalogMax?: number;
  customerId?: string | null;
  requestId?: string | null;
}): Promise<PublicPriceRecommendation | null> {
  if (!isAiDynamicPricingEnabled()) return null;
  const computation = await recommendPrice({
    categoryKey: input.categoryKey,
    regionKey: input.regionKey,
    distanceKm: input.distanceKm,
    urgency01: input.urgency01,
    largeProject: input.largeProject,
    catalogMin: input.catalogMin,
    catalogTypical: input.catalogTypical,
    catalogMax: input.catalogMax,
    customerId: input.customerId,
    requestId: input.requestId,
    persist: true,
  });
  if (!computation) return null;
  return toPublicPriceRecommendation(computation);
}
