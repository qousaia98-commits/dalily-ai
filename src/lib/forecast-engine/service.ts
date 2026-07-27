/**
 * Forecast service — generate, persist, accuracy, provider/customer views.
 * Predictions are advisory only.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  collectForecastRaw,
  invalidateForecastSnapshotCache,
  type ForecastCollectInput,
} from "@/lib/forecast-engine/collect";
import { computeForecastFromSignals } from "@/lib/forecast-engine/engine";
import { FORECAST_ADVISORY_NOTICE } from "@/lib/forecast-engine/explanations";
import { trackForecastEvent } from "@/lib/forecast-engine/observability";
import {
  DEFAULT_FORECAST_WEIGHTS,
  mergeForecastWeights,
} from "@/lib/forecast-engine/weights";
import { isAiDemandForecastingEnabled } from "@/lib/config/feature-flags";
import {
  FORECAST_MODEL_VERSION,
  type CustomerDemandHint,
  type ForecastComputation,
  type ForecastHorizon,
  type ForecastWeight,
  type MarketIntelligenceSummary,
  type ProviderForecastInsights,
  type PublicDemandForecast,
} from "@/lib/forecast-engine/types";
import type { Json } from "@/types/database.types";

const ALL_HORIZONS: ForecastHorizon[] = ["24h", "7d", "30d", "90d"];

async function loadWeights(): Promise<ForecastWeight[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("forecast_signal_weights").select("*");
    if (!data?.length) return DEFAULT_FORECAST_WEIGHTS;
    return mergeForecastWeights(
      DEFAULT_FORECAST_WEIGHTS,
      data.map((r) => ({
        signalKey: r.signal_key,
        category: r.category,
        weight: Number(r.weight),
        enabled: r.enabled,
        mlReady: r.ml_ready,
        description: r.description,
      })),
    );
  } catch {
    return DEFAULT_FORECAST_WEIGHTS;
  }
}

async function resolveExperiment(salt?: string | null): Promise<{
  algorithm: string;
  experimentId: string | null;
}> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("forecast_experiments")
      .select("*")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!data) {
      return { algorithm: FORECAST_MODEL_VERSION, experimentId: null };
    }
    const pct = Number(data.traffic_b_pct ?? 0);
    let bucket = 0;
    const key = salt ?? "anon";
    for (let i = 0; i < key.length; i++) bucket = (bucket + key.charCodeAt(i)) % 100;
    const useB = bucket < pct;
    return {
      algorithm: useB ? data.algorithm_b : data.algorithm_a,
      experimentId: data.experiment_key,
    };
  } catch {
    return { algorithm: FORECAST_MODEL_VERSION, experimentId: null };
  }
}

export function toPublicDemandForecast(
  c: ForecastComputation,
): PublicDemandForecast {
  return {
    horizon: c.horizon,
    expectedDemand: c.expectedDemand,
    confidence: c.confidence,
    trend: c.trend,
    recommendedCapacity: c.recommendedCapacity,
    explanations: c.explanations,
    algorithmVersion: c.algorithmVersion,
    advisoryNotice: c.advisoryNotice,
  };
}

export async function generateForecast(
  input: ForecastCollectInput & {
    providerId?: string | null;
    persist?: boolean;
  },
): Promise<ForecastComputation | null> {
  if (!isAiDemandForecastingEnabled()) return null;
  const started = Date.now();
  const weights = await loadWeights();
  const experiment = await resolveExperiment(
    input.providerId ?? `${input.categoryKey}:${input.horizon}`,
  );
  const raw = await collectForecastRaw(input);
  const computation = computeForecastFromSignals({
    raw,
    weights,
    experimentId: experiment.experimentId,
    modelKey: experiment.algorithm,
    startedAt: started,
    includeMlLayer: experiment.algorithm.includes("ml"),
  });

  void trackForecastEvent("forecast_generated", {
    latencyMs: computation.latencyMs,
    algorithmVersion: computation.algorithmVersion,
    horizon: computation.horizon,
    categoryKey: computation.categoryKey,
    providerId: input.providerId,
  });
  void trackForecastEvent("latency", { latencyMs: computation.latencyMs });
  void trackForecastEvent("model_version", {
    algorithmVersion: computation.algorithmVersion,
  });

  if (input.persist !== false) {
    void persistForecast({
      computation,
      providerId: input.providerId,
    });
  }

  return computation;
}

async function persistForecast(input: {
  computation: ForecastComputation;
  providerId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const c = input.computation;
    const { data: hist } = await admin
      .from("forecast_history")
      .insert({
        model_key: c.modelKey,
        algorithm_version: c.algorithmVersion,
        experiment_id: c.experimentId,
        category_key: c.categoryKey,
        region_key: c.regionKey,
        horizon: c.horizon,
        expected_demand: c.expectedDemand,
        confidence: c.confidence,
        trend: c.trend,
        recommended_capacity: c.recommendedCapacity,
        signal_breakdown: Object.fromEntries(
          c.signals.map((s) => [s.signalKey, s.contribution]),
        ) as Json,
        latency_ms: c.latencyMs,
      })
      .select("id")
      .single();

    if (hist?.id) {
      if (c.explanations.length) {
        await admin.from("forecast_explanations").insert(
          c.explanations.map((e) => ({
            history_id: hist.id,
            code: e.code,
            label_en: e.labelEn,
            label_ar: e.labelAr ?? null,
            audience: "public",
          })),
        );
      }

      const cachedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
      await admin.from("forecast_results").insert({
        history_id: hist.id,
        provider_id: input.providerId ?? null,
        category_key: c.categoryKey,
        region_key: c.regionKey,
        horizon: c.horizon,
        expected_demand: c.expectedDemand,
        confidence: c.confidence,
        trend: c.trend,
        recommended_capacity: c.recommendedCapacity,
        busy_periods: deriveBusyPeriods(c) as Json,
        best_hours: deriveBestHours(c) as Json,
        revenue_opportunity: Math.round(c.expectedDemand * 120_000),
        vacation_windows: deriveVacationWindows(c) as Json,
        public_payload: toPublicDemandForecast(c) as unknown as Json,
        cached_until: cachedUntil,
      });
    }
  } catch {
    /* soft until migration */
  }
}

function deriveBusyPeriods(c: ForecastComputation): string[] {
  if (c.trend === "rising" || c.expectedDemand > 10) {
    return ["Thu–Sat evenings", "Morning peak 08:00–11:00"];
  }
  return ["Typical weekday afternoons"];
}

function deriveBestHours(c: ForecastComputation): string[] {
  if (c.horizon === "24h") return ["09:00–12:00", "17:00–20:00"];
  return ["Weekday mornings", "Thursday–Friday evenings"];
}

function deriveVacationWindows(c: ForecastComputation): string[] {
  if (c.trend === "declining" || c.expectedDemand < 5) {
    return ["Next low-demand midweek window"];
  }
  return ["Prefer midweek troughs after the busy period"];
}

export async function generateMultiHorizonForecast(input: {
  categoryKey: string;
  regionKey?: string | null;
  providerId?: string | null;
  persist?: boolean;
}): Promise<ForecastComputation[]> {
  if (!isAiDemandForecastingEnabled()) return [];
  const results: ForecastComputation[] = [];
  for (const horizon of ALL_HORIZONS) {
    const c = await generateForecast({
      categoryKey: input.categoryKey,
      regionKey: input.regionKey,
      horizon,
      providerId: input.providerId,
      persist: input.persist,
    });
    if (c) results.push(c);
  }
  return results;
}

export async function getProviderForecastInsights(input: {
  providerId: string;
  categoryKey?: string;
}): Promise<ProviderForecastInsights> {
  const empty: ProviderForecastInsights = {
    horizons: [],
    recommendedStaffing: null,
    bestWorkingHours: [],
    busyPeriods: [],
    revenueOpportunity: null,
    suggestedVacationWindows: [],
    currency: "SYP",
  };
  if (!isAiDemandForecastingEnabled()) return empty;

  const computations = await generateMultiHorizonForecast({
    categoryKey: input.categoryKey ?? "general",
    providerId: input.providerId,
    persist: false,
  });
  if (!computations.length) return empty;

  const week = computations.find((c) => c.horizon === "7d") ?? computations[0];
  return {
    horizons: computations.map(toPublicDemandForecast),
    recommendedStaffing: week.recommendedCapacity,
    bestWorkingHours: deriveBestHours(week),
    busyPeriods: deriveBusyPeriods(week),
    revenueOpportunity: Math.round(week.expectedDemand * 120_000),
    suggestedVacationWindows: deriveVacationWindows(week),
    currency: "SYP",
  };
}

export async function getCustomerDemandHint(input: {
  categoryKey?: string;
  regionKey?: string | null;
}): Promise<CustomerDemandHint | null> {
  if (!isAiDemandForecastingEnabled()) return null;
  const c = await generateForecast({
    categoryKey: input.categoryKey ?? "general",
    regionKey: input.regionKey,
    horizon: "24h",
    persist: false,
  });
  if (!c) return null;

  const level =
    c.expectedDemand >= c.recommendedCapacity * 3.5
      ? "high"
      : c.expectedDemand <= c.recommendedCapacity * 1.5
        ? "low"
        : "moderate";

  return {
    demandLevel: level,
    bookEarly: level === "high" || c.trend === "rising",
    fasterAvailability: level === "low",
    estimatedAvailability:
      level === "high" ? "scarce" : level === "low" ? "ample" : "normal",
    explanations: c.explanations,
    advisoryNotice: FORECAST_ADVISORY_NOTICE,
  };
}

export async function getMarketIntelligence(): Promise<MarketIntelligenceSummary> {
  const empty: MarketIntelligenceSummary = {
    growingCategories: [],
    decliningCategories: [],
    regionalShifts: [],
    bookingVelocity: null,
    seasonalNote: null,
  };
  if (!isAiDemandForecastingEnabled()) return empty;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("forecast_market_snapshots")
      .select("*")
      .order("computed_at", { ascending: false })
      .limit(40);
    const rows = data ?? [];
    return {
      growingCategories: rows.filter((r) => r.growing).map((r) => r.category_key),
      decliningCategories: rows
        .filter((r) => r.declining)
        .map((r) => r.category_key),
      regionalShifts: rows
        .filter((r) => r.region_key !== "all")
        .map((r) => ({
          regionKey: r.region_key,
          demandIndex: Number(r.demand_index),
        })),
      bookingVelocity:
        rows[0]?.booking_velocity != null
          ? Number(rows[0].booking_velocity)
          : null,
      seasonalNote:
        new Date().getUTCMonth() >= 5 && new Date().getUTCMonth() <= 8
          ? "Summer seasonality typically lifts AC and outdoor services."
          : null,
    };
  } catch {
    return empty;
  }
}

export async function updateForecastWeight(input: {
  signalKey: string;
  weight: number;
  enabled?: boolean;
}): Promise<boolean> {
  if (!isAiDemandForecastingEnabled()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("forecast_signal_weights")
      .update({
        weight: input.weight,
        enabled: input.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("signal_key", input.signalKey);
    return !error;
  } catch {
    return false;
  }
}

export async function recordForecastAccuracy(input: {
  historyId?: string | null;
  modelKey?: string;
  horizon: ForecastHorizon;
  predictedDemand: number;
  actualDemand: number;
}): Promise<void> {
  if (!isAiDemandForecastingEnabled()) return;
  try {
    const abs = Math.abs(input.actualDemand - input.predictedDemand);
    const pct =
      input.predictedDemand > 0
        ? abs / input.predictedDemand
        : abs;
    const admin = createAdminClient();
    await admin.from("forecast_accuracy").insert({
      history_id: input.historyId ?? null,
      model_key: input.modelKey ?? FORECAST_MODEL_VERSION,
      horizon: input.horizon,
      predicted_demand: input.predictedDemand,
      actual_demand: input.actualDemand,
      absolute_error: abs,
      percent_error: pct,
      evaluated_at: new Date().toISOString(),
    });
    void trackForecastEvent("forecast_accuracy", {
      horizon: input.horizon,
      absoluteError: abs,
      percentError: pct,
    });
  } catch {
    /* soft */
  }
}

export async function refreshForecastMarketSnapshot(input?: {
  categoryKey?: string;
  regionKey?: string;
}): Promise<void> {
  if (!isAiDemandForecastingEnabled()) return;
  try {
    const admin = createAdminClient();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 14);
    const { data: rows } = await admin
      .from("service_requests")
      .select("id, created_at")
      .gte("created_at", since.toISOString())
      .limit(800);
    const count = rows?.length ?? 0;
    const velocity = count / 14;
    const demandIndex = Math.min(1, count / 80);
    await admin.from("forecast_market_snapshots").upsert(
      {
        category_key: input?.categoryKey ?? "general",
        region_key: input?.regionKey ?? "all",
        booking_velocity: Math.round(velocity * 100) / 100,
        demand_index: Math.round(demandIndex * 1000) / 1000,
        cancellation_rate: 0.08,
        complaint_rate: 0.04,
        provider_availability_index: 0.55,
        pricing_trend_index: 0.5,
        growing: demandIndex >= 0.55,
        declining: demandIndex <= 0.3,
        sample_count: count,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "category_key,region_key" },
    );
    invalidateForecastSnapshotCache();
  } catch {
    /* soft */
  }
}

export async function simulateForecast(input: {
  categoryKey: string;
  regionKey?: string;
  horizon?: ForecastHorizon;
}): Promise<{
  public: PublicDemandForecast;
  latencyMs: number;
  signalCount?: number;
} | null> {
  const c = await generateForecast({
    categoryKey: input.categoryKey,
    regionKey: input.regionKey,
    horizon: input.horizon ?? "7d",
    persist: false,
  });
  if (!c) return null;
  return {
    public: toPublicDemandForecast(c),
    latencyMs: c.latencyMs,
    signalCount: c.signals.length,
  };
}

export async function acceptForecastInsight(input: {
  providerId: string;
  horizon: ForecastHorizon;
}): Promise<void> {
  void trackForecastEvent("forecast_accepted", {
    providerId: input.providerId,
    horizon: input.horizon,
  });
}
