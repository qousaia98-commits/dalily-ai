/**
 * Forecast engine — weighted multiplicative factors on baseline demand.
 * Advisory only — never guarantees outcomes.
 */

import {
  FORECAST_ADVISORY_NOTICE,
  buildForecastExplanations,
} from "@/lib/forecast-engine/explanations";
import {
  FORECAST_SIGNAL_COLLECTORS,
  ML_FORECAST_COLLECTOR,
  type ForecastSignalCollector,
} from "@/lib/forecast-engine/signals";
import { DEFAULT_FORECAST_WEIGHTS } from "@/lib/forecast-engine/weights";
import {
  FORECAST_ML_VERSION,
  FORECAST_MODEL_VERSION,
  type ForecastComputation,
  type ForecastHorizon,
  type ForecastRawSignals,
  type ForecastSignalResult,
  type ForecastTrend,
  type ForecastWeight,
} from "@/lib/forecast-engine/types";

const HORIZON_SCALE: Record<ForecastHorizon, number> = {
  "24h": 1,
  "7d": 6.5,
  "30d": 26,
  "90d": 75,
};

function roundDemand(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeForecastFromSignals(input: {
  raw: ForecastRawSignals;
  weights?: ForecastWeight[];
  collectors?: ForecastSignalCollector[];
  includeMlLayer?: boolean;
  experimentId?: string | null;
  modelKey?: string;
  startedAt?: number;
}): ForecastComputation {
  const started = input.startedAt ?? Date.now();
  const weights = input.weights ?? DEFAULT_FORECAST_WEIGHTS;
  const weightByKey = new Map(weights.map((w) => [w.signalKey, w]));
  let collectors = input.collectors ?? FORECAST_SIGNAL_COLLECTORS;

  if (
    input.includeMlLayer !== false &&
    input.raw.mlDemandFactor != null &&
    Number(input.raw.mlDemandFactor) > 0
  ) {
    collectors = [...collectors, ML_FORECAST_COLLECTOR];
    if (!weightByKey.has("ml_forecast")) {
      weightByKey.set("ml_forecast", {
        signalKey: "ml_forecast",
        category: "ml",
        weight: 1,
        enabled: true,
        mlReady: true,
      });
    }
  }

  const signals: ForecastSignalResult[] = [];
  let weightedLog = 0;
  let weightAbs = 0;
  let mlContribution = 0;

  for (const collector of collectors) {
    const w = weightByKey.get(collector.signalKey);
    if (!w || !w.enabled) continue;
    const computed = collector.computeFactor(input.raw);
    const isMl = Boolean(computed.metadata?.ml);
    const intensity = Math.min(1, Math.abs(w.weight) / 1.5);
    const blended =
      1 + (computed.factor - 1) * intensity * Math.sign(w.weight || 1);
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
    weightedLog += Math.log(Math.max(0.55, blended)) * Math.abs(w.weight);
    weightAbs += Math.abs(w.weight);
    if (isMl) mlContribution += contribution;
  }

  const compositeFactor =
    weightAbs > 0 ? Math.exp(weightedLog / weightAbs) : 1;

  const scale = HORIZON_SCALE[input.raw.horizon] ?? 1;
  const expectedDemand = roundDemand(
    Math.max(0.1, input.raw.baselineDemand * compositeFactor * scale),
  );

  let trend: ForecastTrend = "stable";
  if (compositeFactor >= 1.12) trend = "rising";
  else if (compositeFactor <= 0.92) trend = "declining";

  let confidence = 0.5;
  if (input.raw.historicalIndex > 0.2) confidence += 0.15;
  if (input.raw.categoryDemandIndex > 0) confidence += 0.1;
  if (input.raw.horizon === "24h" || input.raw.horizon === "7d") confidence += 0.08;
  else confidence -= 0.05;
  confidence = Math.min(0.9, Math.max(0.35, confidence));

  // Capacity heuristic: staff slots ≈ demand / typical jobs per worker-day
  const jobsPerWorker =
    input.raw.horizon === "24h" ? 4 : input.raw.horizon === "7d" ? 18 : 70;
  const recommendedCapacity = Math.max(
    1,
    Math.round((expectedDemand / jobsPerWorker) * 10) / 10,
  );

  const explanations = buildForecastExplanations({
    raw: input.raw,
    signals,
    trend,
    expectedDemand: expectedDemand / scale,
  });

  return {
    horizon: input.raw.horizon,
    expectedDemand,
    confidence: Math.round(confidence * 1000) / 1000,
    trend,
    recommendedCapacity,
    explanations,
    algorithmVersion:
      mlContribution !== 0
        ? `${FORECAST_MODEL_VERSION}+${FORECAST_ML_VERSION}`
        : FORECAST_MODEL_VERSION,
    advisoryNotice: FORECAST_ADVISORY_NOTICE,
    signals,
    latencyMs: Date.now() - started,
    experimentId: input.experimentId ?? null,
    categoryKey: input.raw.categoryKey,
    regionKey: input.raw.regionKey,
    modelKey: input.modelKey ?? FORECAST_MODEL_VERSION,
  };
}
