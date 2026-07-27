/**
 * Public AI match explanations — never expose internal scores.
 */

import type {
  MatchRawSignals,
  MatchSignalResult,
  PublicMatchExplanation,
} from "@/lib/matching-engine/types";

export function buildMatchExplanations(input: {
  raw: MatchRawSignals;
  signals: MatchSignalResult[];
}): PublicMatchExplanation[] {
  const out: PublicMatchExplanation[] = [];
  const byKey = new Map(input.signals.map((s) => [s.signalKey, s]));

  if ((byKey.get("review_quality")?.normalizedValue ?? 0) >= 0.75) {
    out.push({
      code: "highly_rated",
      labelEn: "Highly rated by customers.",
      labelAr: "تقييم مرتفع من العملاء.",
    });
  }
  if (
    input.raw.distanceKm != null &&
    input.raw.distanceKm <= 5 &&
    (byKey.get("distance")?.normalizedValue ?? 0) >= 0.8
  ) {
    out.push({
      code: "very_close",
      labelEn: "Very close to your location.",
      labelAr: "قريب جداً من موقعك.",
    });
  }
  if (input.raw.acceptingRequests && !input.raw.vacationMode && !input.raw.pauseMode) {
    out.push({
      code: "available_today",
      labelEn: "Available today.",
      labelAr: "متاح اليوم.",
    });
  }
  if ((byKey.get("preferred_history")?.normalizedValue ?? 0) >= 1) {
    out.push({
      code: "similar_jobs",
      labelEn: "Frequently chosen for similar jobs.",
      labelAr: "يُختار كثيراً لمهام مشابهة.",
    });
  }
  if ((byKey.get("response_time")?.normalizedValue ?? 0) >= 0.75) {
    out.push({
      code: "excellent_communication",
      labelEn: "Excellent communication.",
      labelAr: "تواصل ممتاز.",
    });
  }
  if (input.raw.verificationStatus === "verified") {
    out.push({
      code: "verified",
      labelEn: "Verified provider.",
      labelAr: "مزود موثّق.",
    });
  }
  if (input.raw.isFavourite) {
    out.push({
      code: "favourite",
      labelEn: "One of your favourite providers.",
      labelAr: "من مزوديك المفضلين.",
    });
  }
  if (
    input.raw.trustLevel === "excellent" ||
    input.raw.trustLevel === "very_good"
  ) {
    out.push({
      code: "trusted",
      labelEn: "Strong trust on Dalily.",
      labelAr: "ثقة عالية على دليلي.",
    });
  }
  if (input.raw.reviewCountForFairness < 8) {
    out.push({
      code: "rising_talent",
      labelEn: "Rising provider worth trying.",
      labelAr: "مزود صاعد يستحق التجربة.",
    });
  }

  return out.slice(0, 4);
}
