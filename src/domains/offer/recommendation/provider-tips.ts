/**
 * Provider-facing improvement tips derived from public-safe signals only.
 * Never includes ranking weights or internal formulas.
 */

import type { OfferDecisionSignals } from "./types";

export type ProviderVisibilityTip = {
  code:
    | "complete_profile"
    | "get_verified"
    | "collect_reviews"
    | "improve_response"
    | "reduce_cancellations"
    | "add_portfolio"
    | "stay_available";
  severity: "high" | "medium" | "low";
};

export function buildProviderVisibilityTips(
  signals: Pick<
    OfferDecisionSignals,
    | "profileCompleteness"
    | "verified"
    | "reviewCount"
    | "ratingAvg"
    | "responseHoursAvg"
    | "cancellationRate"
    | "portfolioSize"
    | "availableNow"
    | "completedJobs"
  >,
): ProviderVisibilityTip[] {
  const tips: ProviderVisibilityTip[] = [];
  if (signals.profileCompleteness < 70) {
    tips.push({ code: "complete_profile", severity: "high" });
  }
  if (!signals.verified) {
    tips.push({ code: "get_verified", severity: "high" });
  }
  if (signals.reviewCount < 5) {
    tips.push({ code: "collect_reviews", severity: "medium" });
  }
  if (signals.responseHoursAvg != null && signals.responseHoursAvg > 12) {
    tips.push({ code: "improve_response", severity: "medium" });
  }
  if (signals.cancellationRate != null && signals.cancellationRate > 0.15) {
    tips.push({ code: "reduce_cancellations", severity: "high" });
  }
  if (signals.portfolioSize < 3) {
    tips.push({ code: "add_portfolio", severity: "low" });
  }
  if (!signals.availableNow) {
    tips.push({ code: "stay_available", severity: "medium" });
  }
  return tips.slice(0, 5);
}
