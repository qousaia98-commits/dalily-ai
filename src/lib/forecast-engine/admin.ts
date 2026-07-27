/**
 * Admin forecast center queries.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORECAST_WEIGHTS } from "@/lib/forecast-engine/weights";
import {
  FORECAST_MODEL_VERSION,
  type ForecastWeight,
} from "@/lib/forecast-engine/types";

export type AdminForecastDashboard = {
  weights: ForecastWeight[];
  models: Array<{
    modelKey: string;
    title: string;
    algorithm: string;
    enabled: boolean;
    mlReady: boolean;
    isDefault: boolean;
  }>;
  recentHistory: Array<{
    id: string;
    categoryKey: string | null;
    horizon: string;
    expectedDemand: number;
    confidence: number;
    trend: string;
    algorithmVersion: string;
    latencyMs: number | null;
    createdAt: string;
  }>;
  accuracyStats: {
    total: number;
    avgAbsError: number | null;
    avgPctError: number | null;
  };
  marketSnapshots: Array<{
    categoryKey: string;
    regionKey: string;
    demandIndex: number;
    bookingVelocity: number;
    growing: boolean;
    declining: boolean;
    sampleCount: number;
    computedAt: string;
  }>;
  avgLatencyMs: number | null;
  experiment: {
    key: string;
    active: boolean;
    algorithmA: string;
    algorithmB: string;
    trafficBPct: number;
  } | null;
  modelVersion: string;
};

export async function getAdminForecastDashboard(): Promise<AdminForecastDashboard> {
  const admin = createAdminClient();

  let weights = DEFAULT_FORECAST_WEIGHTS;
  try {
    const { data } = await admin
      .from("forecast_signal_weights")
      .select("*")
      .order("signal_key");
    if (data?.length) {
      weights = data.map((r) => ({
        signalKey: r.signal_key,
        category: r.category,
        weight: Number(r.weight),
        enabled: r.enabled,
        mlReady: r.ml_ready,
        description: r.description,
      }));
    }
  } catch {
    /* defaults */
  }

  let models: AdminForecastDashboard["models"] = [];
  try {
    const { data } = await admin.from("forecast_models").select("*").order("model_key");
    models = (data ?? []).map((m) => ({
      modelKey: m.model_key,
      title: m.title,
      algorithm: m.algorithm,
      enabled: m.enabled,
      mlReady: m.ml_ready,
      isDefault: m.is_default,
    }));
  } catch {
    /* empty */
  }

  let recentHistory: AdminForecastDashboard["recentHistory"] = [];
  try {
    const { data } = await admin
      .from("forecast_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    recentHistory = (data ?? []).map((h) => ({
      id: h.id,
      categoryKey: h.category_key,
      horizon: h.horizon,
      expectedDemand: Number(h.expected_demand),
      confidence: Number(h.confidence),
      trend: h.trend,
      algorithmVersion: h.algorithm_version,
      latencyMs: h.latency_ms,
      createdAt: h.created_at,
    }));
  } catch {
    /* empty */
  }

  const accuracyStats = {
    total: 0,
    avgAbsError: null as number | null,
    avgPctError: null as number | null,
  };
  try {
    const { data } = await admin
      .from("forecast_accuracy")
      .select("absolute_error, percent_error")
      .limit(200);
    const rows = data ?? [];
    accuracyStats.total = rows.length;
    if (rows.length) {
      accuracyStats.avgAbsError =
        Math.round(
          (rows.reduce((a, b) => a + Number(b.absolute_error ?? 0), 0) /
            rows.length) *
            100,
        ) / 100;
      accuracyStats.avgPctError =
        Math.round(
          (rows.reduce((a, b) => a + Number(b.percent_error ?? 0), 0) /
            rows.length) *
            1000,
        ) / 1000;
    }
  } catch {
    /* empty */
  }

  let marketSnapshots: AdminForecastDashboard["marketSnapshots"] = [];
  try {
    const { data } = await admin
      .from("forecast_market_snapshots")
      .select("*")
      .order("computed_at", { ascending: false })
      .limit(20);
    marketSnapshots = (data ?? []).map((m) => ({
      categoryKey: m.category_key,
      regionKey: m.region_key,
      demandIndex: Number(m.demand_index),
      bookingVelocity: Number(m.booking_velocity),
      growing: m.growing,
      declining: m.declining,
      sampleCount: m.sample_count,
      computedAt: m.computed_at,
    }));
  } catch {
    /* empty */
  }

  const latencies = recentHistory
    .map((h) => h.latencyMs)
    .filter((n): n is number => typeof n === "number");
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

  let experiment: AdminForecastDashboard["experiment"] = null;
  try {
    const { data } = await admin
      .from("forecast_experiments")
      .select("*")
      .eq("experiment_key", "forecast_default")
      .maybeSingle();
    if (data) {
      experiment = {
        key: data.experiment_key,
        active: data.active,
        algorithmA: data.algorithm_a,
        algorithmB: data.algorithm_b,
        trafficBPct: Number(data.traffic_b_pct),
      };
    }
  } catch {
    /* empty */
  }

  return {
    weights,
    models,
    recentHistory,
    accuracyStats,
    marketSnapshots,
    avgLatencyMs,
    experiment,
    modelVersion: FORECAST_MODEL_VERSION,
  };
}

export async function getForecastHistoryReplay(historyId: string): Promise<{
  public: {
    horizon: string;
    expectedDemand: number;
    confidence: number;
    trend: string;
    recommendedCapacity: number | null;
    algorithmVersion: string;
  };
  explanations: Array<{ code: string; labelEn: string; labelAr: string | null }>;
  signalBreakdown: Record<string, unknown>;
  latencyMs: number | null;
} | null> {
  try {
    const admin = createAdminClient();
    const { data: h } = await admin
      .from("forecast_history")
      .select("*")
      .eq("id", historyId)
      .maybeSingle();
    if (!h) return null;

    const { data: expl } = await admin
      .from("forecast_explanations")
      .select("code, label_en, label_ar")
      .eq("history_id", historyId);

    return {
      public: {
        horizon: h.horizon,
        expectedDemand: Number(h.expected_demand),
        confidence: Number(h.confidence),
        trend: h.trend,
        recommendedCapacity:
          h.recommended_capacity != null
            ? Number(h.recommended_capacity)
            : null,
        algorithmVersion: h.algorithm_version,
      },
      explanations: (expl ?? []).map((e) => ({
        code: e.code,
        labelEn: e.label_en,
        labelAr: e.label_ar,
      })),
      signalBreakdown: (h.signal_breakdown ?? {}) as Record<string, unknown>,
      latencyMs: h.latency_ms,
    };
  } catch {
    return null;
  }
}
