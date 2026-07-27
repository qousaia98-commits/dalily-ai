/**
 * Smart matching engine — modular weight × normalized signal + fairness + ML layer.
 */

import { computeFairnessBoost } from "@/lib/matching-engine/fairness";
import { buildMatchExplanations } from "@/lib/matching-engine/explanations";
import {
  MATCH_SIGNAL_COLLECTORS,
  ML_RANKER_COLLECTOR,
  type MatchSignalCollector,
} from "@/lib/matching-engine/signals";
import { DEFAULT_MATCHING_WEIGHTS } from "@/lib/matching-engine/weights";
import {
  MATCHING_ML_VERSION,
  MATCHING_MODEL_VERSION,
  type MatchComputation,
  type MatchRawSignals,
  type MatchSignalResult,
  type MatchWeight,
} from "@/lib/matching-engine/types";

export function computeMatchFromSignals(input: {
  providerId: string;
  raw: MatchRawSignals;
  weights?: MatchWeight[];
  collectors?: MatchSignalCollector[];
  includeMlLayer?: boolean;
  requestSalt?: string;
  fairnessState?: {
    explorationBoost?: number;
    coldStartBoost?: number;
    boostExpiresAt?: string | null;
  };
  experimentId?: string | null;
  startedAt?: number;
}): MatchComputation {
  const started = input.startedAt ?? Date.now();
  const weights = input.weights ?? DEFAULT_MATCHING_WEIGHTS;
  const weightByKey = new Map(weights.map((w) => [w.signalKey, w]));
  let collectors = input.collectors ?? MATCH_SIGNAL_COLLECTORS;

  if (
    input.includeMlLayer !== false &&
    input.raw.mlRankScore != null &&
    Number(input.raw.mlRankScore) > 0
  ) {
    collectors = [...collectors, ML_RANKER_COLLECTOR];
    if (!weightByKey.has("ml_ranker")) {
      weightByKey.set("ml_ranker", {
        signalKey: "ml_ranker",
        category: "ml",
        weight: 1,
        enabled: true,
        mlReady: true,
      });
    }
  }

  const signals: MatchSignalResult[] = [];
  let weightedSum = 0;
  let weightAbsTotal = 0;
  let mlContribution = 0;

  for (const collector of collectors) {
    const w = weightByKey.get(collector.signalKey);
    if (!w || !w.enabled) continue;
    const computed = collector.computeNormalized(input.raw);
    const contribution = computed.normalizedValue * w.weight;
    const isMl = Boolean(computed.metadata?.ml);
    signals.push({
      signalKey: collector.signalKey,
      category: collector.category,
      rawValue: computed.rawValue,
      normalizedValue: computed.normalizedValue,
      weight: w.weight,
      contribution,
      source: isMl ? "ml" : "rule",
    });
    weightedSum += contribution;
    weightAbsTotal += Math.abs(w.weight);
    if (isMl) mlContribution += contribution;
  }

  // Normalize to 0..1 then 0..100; negative weights already reduce sum
  const score01 =
    weightAbsTotal > 0
      ? Math.max(0, Math.min(1, (weightedSum + weightAbsTotal * 0.15) / (weightAbsTotal * 1.15)))
      : 0.5;

  const fairnessBoost = computeFairnessBoost({
    reviewCount: input.raw.reviewCountForFairness,
    providerId: input.providerId,
    requestSalt: input.requestSalt,
    explorationBoost: input.fairnessState?.explorationBoost,
    coldStartBoost: input.fairnessState?.coldStartBoost,
    boostExpiresAt: input.fairnessState?.boostExpiresAt,
  });

  const internalScore =
    Math.round(
      Math.max(0, Math.min(100, (score01 + fairnessBoost) * 100)) * 100,
    ) / 100;

  const explanations = buildMatchExplanations({
    raw: input.raw,
    signals,
  });

  return {
    providerId: input.providerId,
    internalScore,
    fairnessBoost,
    mlContribution: Math.round(mlContribution * 1000) / 1000,
    signals,
    explanations,
    algorithmVersion:
      mlContribution > 0
        ? `${MATCHING_MODEL_VERSION}+${MATCHING_ML_VERSION}`
        : MATCHING_MODEL_VERSION,
    experimentId: input.experimentId ?? null,
    latencyMs: Date.now() - started,
  };
}
