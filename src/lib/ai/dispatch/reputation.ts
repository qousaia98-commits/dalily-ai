import { clamp01 } from "@/lib/ai/types";
import type { ReputationBreakdown } from "@/lib/ai/dispatch/types";
import type { ProviderBehaviourSignals } from "@/lib/ai/provider/behaviour";

/**
 * Dynamic reputation 0–100 — one ranking factor among many.
 *
 * Formula (weights):
 * ratings 22% · completion 18% · low-cancel 15% · response 15%
 * repeat 10% · verification 12% · reliability(performance) 8%
 */
export function computeReputation(input: {
  behaviour: ProviderBehaviourSignals | null;
  ratingAvg: number;
  verificationStatus: string;
  complaintRate?: number | null;
}): ReputationBreakdown {
  const b = input.behaviour;
  const ratings = clamp01(input.ratingAvg / 5);
  const completion = b?.completionRate != null ? clamp01(b.completionRate) : 0.5;
  const cancellation =
    b?.cancellationRate != null ? clamp01(1 - b.cancellationRate) : 0.55;
  const response =
    b?.avgResponseHours != null
      ? clamp01(1 - Math.min(b.avgResponseHours, 48) / 48)
      : 0.5;
  const repeat =
    b?.repeatCustomerRate != null ? clamp01(b.repeatCustomerRate) : 0.4;
  const verification = input.verificationStatus === "verified" ? 1 : 0.35;
  const reliability = b ? clamp01(b.performanceScore) : 0.5;
  const complaintPenalty =
    input.complaintRate != null ? clamp01(1 - input.complaintRate) : 1;

  const score01 = clamp01(
    (ratings * 0.22 +
      completion * 0.18 +
      cancellation * 0.15 +
      response * 0.15 +
      repeat * 0.1 +
      verification * 0.12 +
      reliability * 0.08) *
      (0.85 + 0.15 * complaintPenalty),
  );

  return {
    score: Math.round(score01 * 1000) / 10,
    ratings,
    completion,
    cancellation,
    response,
    repeat,
    verification,
    reliability,
  };
}
