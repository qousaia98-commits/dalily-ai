import type { PlanSlug } from "@/lib/subscription/types";
import type { CustomerPreferenceProfile, ProviderPerformanceRow } from "./types";
import {
  LEARNING_MAX_ADJUSTMENT,
  PREFERENCE_MAX_ADJUSTMENT,
} from "./types";
import { resolveMatchConfidence } from "./confidence";
import type { MatchConfidence } from "./types";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Learning adjustment from performance score.
 * Neutral at 0.5 → no change. Never exceeds LEARNING_MAX_ADJUSTMENT.
 * Scaled by dataQuality so thin data barely moves ranking.
 */
export function learningAdjustmentFromPerformance(
  perf: ProviderPerformanceRow | null | undefined,
): number {
  if (!perf) return 0;
  const centered = (perf.performanceScore - 0.5) * 2; // -1 … +1
  return centered * LEARNING_MAX_ADJUSTMENT * clamp01(perf.dataQuality);
}

/**
 * Small personalization nudge from learned customer preferences.
 */
export function preferenceAdjustment(input: {
  preferences: CustomerPreferenceProfile | null | undefined;
  distanceKm: number | null;
  planSlug: PlanSlug;
  rating: number;
  responseTimeHours: number | null;
}): number {
  const prefs = input.preferences;
  if (!prefs || prefs.sampleSize < 2) return 0;

  let nudge = 0;
  const strength = Math.min(1, prefs.sampleSize / 10);

  if (input.distanceKm != null && Number.isFinite(input.distanceKm)) {
    const nearbySignal = clamp01(1 - input.distanceKm / 15);
    nudge += (prefs.preferNearby - 0.5) * nearbySignal * PREFERENCE_MAX_ADJUSTMENT;
  }

  const premiumSignal = input.planSlug === "premium" ? 1 : input.planSlug === "pro" ? 0.6 : 0.2;
  nudge += (prefs.preferPremium - 0.5) * premiumSignal * PREFERENCE_MAX_ADJUSTMENT;

  const ratingSignal = clamp01(input.rating / 5);
  nudge += (prefs.preferHighRating - 0.5) * ratingSignal * PREFERENCE_MAX_ADJUSTMENT;

  if (input.responseTimeHours != null) {
    const fastSignal = clamp01(1 - input.responseTimeHours / 24);
    nudge +=
      (prefs.preferFastResponse - 0.5) * fastSignal * PREFERENCE_MAX_ADJUSTMENT;
  }

  return clamp01(0.5 + nudge * strength) - 0.5; // keep small
}

/**
 * Final Match Score = Smart Match + Learning + Preferences.
 * Learning never replaces Smart Match.
 */
export function applyLearningToSmartMatch(input: {
  smartMatchScore: number;
  performance: ProviderPerformanceRow | null | undefined;
  preferences?: CustomerPreferenceProfile | null;
  distanceKm?: number | null;
  planSlug?: PlanSlug;
  rating?: number;
  responseTimeHours?: number | null;
}): {
  finalScore: number;
  learningAdjustment: number;
  preferenceAdjustment: number;
  confidence: MatchConfidence | null;
} {
  const learningAdj = learningAdjustmentFromPerformance(input.performance);
  const prefAdj = preferenceAdjustment({
    preferences: input.preferences,
    distanceKm: input.distanceKm ?? null,
    planSlug: input.planSlug ?? "free",
    rating: input.rating ?? 0,
    responseTimeHours: input.responseTimeHours ?? null,
  });

  const finalScore = clamp01(input.smartMatchScore + learningAdj + prefAdj);
  const confidence = input.performance
    ? resolveMatchConfidence({
        sampleSize: input.performance.sampleSize,
        dataQuality: input.performance.dataQuality,
      })
    : null;

  return {
    finalScore,
    learningAdjustment: learningAdj,
    preferenceAdjustment: prefAdj,
    confidence,
  };
}
