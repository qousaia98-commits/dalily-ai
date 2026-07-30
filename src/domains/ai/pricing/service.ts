/**
 * Pricing facade — wraps pricing-engine; never forces provider prices.
 */

import { isAiPricingEnabled, isAiPlatformEnabled } from "@/lib/config/feature-flags";
import { recommendPrice } from "@/lib/pricing-engine/service";
import type { PriceRecommendInput } from "@/lib/pricing-engine/collect";
import type { AiPriceEstimateView } from "@/domains/ai/shared/types";

export async function estimatePriceRange(
  input: PriceRecommendInput & {
    providerId?: string | null;
    customerId?: string | null;
    requestId?: string | null;
  },
): Promise<AiPriceEstimateView | null> {
  if (!isAiPlatformEnabled() || !isAiPricingEnabled()) return null;

  const computation = await recommendPrice({
    ...input,
    persist: true,
  });
  if (!computation) return null;

  return {
    low: computation.suggestedMin,
    expected: computation.suggestedAvg,
    premium: computation.suggestedPremium,
    currency: computation.currency,
    confidence: computation.confidence,
    marketPosition: computation.marketPosition,
    explanations: computation.explanations
      .map((e) => e.labelEn || e.code)
      .filter(Boolean),
    advisoryOnly: true,
  };
}

export type { PriceRecommendInput };
