/**
 * Modular reputation engine — weight × normalized signal.
 * No hardcoded category totals; adding signals only requires a collector + weight row.
 */

import { SIGNAL_COLLECTORS } from "@/lib/reputation/signals";
import { DEFAULT_REPUTATION_WEIGHTS, mergeWeights } from "@/lib/reputation/weights";
import { mapScoreToTrustLevel, trustLevelBoost } from "@/lib/reputation/levels";
import {
  REPUTATION_MODEL_VERSION,
  type ProviderReputationRaw,
  type ReputationCategory,
  type ReputationComputation,
  type ReputationTrend,
  type SignalCollector,
  type SignalResult,
  type SignalWeight,
} from "@/lib/reputation/types";

export function computeReputationFromSignals(input: {
  providerId: string;
  raw: ProviderReputationRaw;
  weights?: SignalWeight[];
  collectors?: SignalCollector[];
  previousScore?: number | null;
  forceNeedsAttention?: boolean;
}): ReputationComputation {
  const weights = input.weights ?? DEFAULT_REPUTATION_WEIGHTS;
  const collectors = input.collectors ?? SIGNAL_COLLECTORS;
  const weightByKey = new Map(weights.map((w) => [w.signalKey, w]));
  const ctx = { providerId: input.providerId, raw: input.raw };

  const signals: SignalResult[] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  for (const collector of collectors) {
    const w = weightByKey.get(collector.signalKey);
    if (!w || !w.enabled) continue;
    const computed = collector.computeNormalized(ctx);
    const contribution = computed.normalizedValue * w.weight;
    signals.push({
      signalKey: collector.signalKey,
      category: collector.category,
      rawValue: computed.rawValue,
      normalizedValue: computed.normalizedValue,
      weight: w.weight,
      contribution,
      source: computed.metadata?.ml ? "ml" : "heuristic",
      metadata: computed.metadata,
    });
    weightedSum += contribution;
    weightTotal += w.weight;
  }

  const score01 = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const internalScore = Math.round(Math.max(0, Math.min(100, score01 * 100)) * 100) / 100;

  const trustLevel = mapScoreToTrustLevel(internalScore, {
    reviewCount: input.raw.reviewCount,
    forceNeedsAttention:
      input.forceNeedsAttention ||
      (input.raw.complaintRate != null && input.raw.complaintRate > 0.25) ||
      input.raw.policyViolationCount >= 3,
  });

  const trend = resolveTrend(internalScore, input.previousScore ?? null);
  const boosts = trustLevelBoost(trustLevel);

  const breakdownByCategory = emptyCategoryBreakdown();
  const categoryWeight = emptyCategoryBreakdown();
  for (const s of signals) {
    breakdownByCategory[s.category] += s.contribution;
    categoryWeight[s.category] += s.weight;
  }
  for (const cat of Object.keys(breakdownByCategory) as ReputationCategory[]) {
    const tw = categoryWeight[cat];
    breakdownByCategory[cat] =
      tw > 0
        ? Math.round((breakdownByCategory[cat] / tw) * 1000) / 1000
        : 0;
  }

  return {
    providerId: input.providerId,
    internalScore,
    trustLevel,
    trend,
    searchBoost: boosts.searchBoost,
    recommendationBoost: boosts.recommendationBoost,
    signals,
    breakdownByCategory,
    modelVersion: REPUTATION_MODEL_VERSION,
    computedAt: new Date().toISOString(),
  };
}

function resolveTrend(
  score: number,
  previous: number | null,
): ReputationTrend {
  if (previous == null) return "stable";
  const delta = score - previous;
  if (delta >= 3) return "rising";
  if (delta <= -3) return "declining";
  return "stable";
}

function emptyCategoryBreakdown(): Record<ReputationCategory, number> {
  return {
    verification: 0,
    reviews: 0,
    booking: 0,
    communication: 0,
    reliability: 0,
    activity: 0,
  };
}

export { mergeWeights };
