/**
 * Pricing engine — weighted multiplicative factors on market base.
 * Dalily never forces the final price.
 */

import { buildPricingExplanations } from "@/lib/pricing-engine/explanations";
import {
  ML_PRICING_COLLECTOR,
  PRICING_SIGNAL_COLLECTORS,
  type PricingSignalCollector,
} from "@/lib/pricing-engine/signals";
import { DEFAULT_PRICING_WEIGHTS } from "@/lib/pricing-engine/weights";
import {
  PRICING_ML_VERSION,
  PRICING_MODEL_VERSION,
  type PricingComputation,
  type PricingRawSignals,
  type PricingSignalResult,
  type PricingWeight,
} from "@/lib/pricing-engine/types";

function roundMoney(n: number): number {
  return Math.round(n / 1000) * 1000;
}

export function computePriceFromSignals(input: {
  raw: PricingRawSignals;
  weights?: PricingWeight[];
  collectors?: PricingSignalCollector[];
  includeMlLayer?: boolean;
  experimentId?: string | null;
  startedAt?: number;
}): PricingComputation {
  const started = input.startedAt ?? Date.now();
  const weights = input.weights ?? DEFAULT_PRICING_WEIGHTS;
  const weightByKey = new Map(weights.map((w) => [w.signalKey, w]));
  let collectors = input.collectors ?? PRICING_SIGNAL_COLLECTORS;

  if (
    input.includeMlLayer !== false &&
    input.raw.mlPriceFactor != null &&
    Number(input.raw.mlPriceFactor) > 0
  ) {
    collectors = [...collectors, ML_PRICING_COLLECTOR];
    if (!weightByKey.has("ml_pricing")) {
      weightByKey.set("ml_pricing", {
        signalKey: "ml_pricing",
        category: "ml",
        weight: 1,
        enabled: true,
        mlReady: true,
      });
    }
  }

  const signals: PricingSignalResult[] = [];
  let weightedLog = 0;
  let weightAbs = 0;
  let mlContribution = 0;

  for (const collector of collectors) {
    if (collector.signalKey === "service_category") {
      // Base is applied as money, not as factor product seed
      const w = weightByKey.get(collector.signalKey);
      if (!w || !w.enabled) continue;
      const computed = collector.computeFactor(input.raw);
      signals.push({
        signalKey: collector.signalKey,
        category: collector.category,
        rawValue: computed.rawValue,
        factor: 1,
        weight: w.weight,
        contribution: 0,
        source: "rule",
      });
      continue;
    }

    const w = weightByKey.get(collector.signalKey);
    if (!w || !w.enabled) continue;
    const computed = collector.computeFactor(input.raw);
    const isMl = Boolean(computed.metadata?.ml);
    // Blend factor toward 1 by weight intensity
    const intensity = Math.min(1, Math.abs(w.weight) / 1.5);
    const blended = 1 + (computed.factor - 1) * intensity * Math.sign(w.weight || 1);
    const contribution = blended - 1;
    signals.push({
      signalKey: collector.signalKey,
      category: collector.category,
      rawValue: computed.rawValue,
      factor: blended,
      weight: w.weight,
      contribution,
      source: isMl ? "ml" : "rule",
    });
    weightedLog += Math.log(Math.max(0.5, blended)) * Math.abs(w.weight);
    weightAbs += Math.abs(w.weight);
    if (isMl) mlContribution += contribution;
  }

  const compositeFactor =
    weightAbs > 0 ? Math.exp(weightedLog / weightAbs) : 1;

  const base = Math.max(1000, input.raw.baseMarketAvg);
  const suggestedAvg = roundMoney(base * compositeFactor);
  const suggestedMin = roundMoney(
    Math.min(suggestedAvg * 0.82, Math.max(input.raw.baseMarketMin, suggestedAvg * 0.75)),
  );
  const suggestedPremium = roundMoney(
    Math.max(suggestedAvg * 1.18, Math.min(input.raw.baseMarketMax * 1.05, suggestedAvg * 1.35)),
  );

  let confidence = 0.55;
  if (input.raw.historicalAvg != null) confidence += 0.15;
  if (input.raw.demandIndex > 0) confidence += 0.1;
  confidence = Math.min(0.92, confidence);

  const marketPosition =
    suggestedAvg <= input.raw.baseMarketAvg * 0.92
      ? "budget"
      : suggestedAvg >= input.raw.baseMarketAvg * 1.12
        ? "premium"
        : "fair";

  const explanations = buildPricingExplanations({
    raw: input.raw,
    signals,
  });

  return {
    suggestedMin,
    suggestedAvg,
    suggestedPremium,
    currency: input.raw.currency,
    confidence: Math.round(confidence * 1000) / 1000,
    marketPosition,
    explanations,
    algorithmVersion:
      mlContribution !== 0
        ? `${PRICING_MODEL_VERSION}+${PRICING_ML_VERSION}`
        : PRICING_MODEL_VERSION,
    signals,
    latencyMs: Date.now() - started,
    experimentId: input.experimentId ?? null,
    categoryKey: input.raw.categoryKey,
    regionKey: input.raw.regionKey,
  };
}
