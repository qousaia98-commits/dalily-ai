/**
 * Admin pricing center — weights, history replay, market, experiments.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRICING_WEIGHTS } from "@/lib/pricing-engine/weights";
import {
  PRICING_MODEL_VERSION,
  type PricingWeight,
} from "@/lib/pricing-engine/types";

export type AdminPricingDashboard = {
  weights: PricingWeight[];
  recentHistory: Array<{
    id: string;
    categoryKey: string | null;
    suggestedMin: number;
    suggestedAvg: number;
    suggestedPremium: number;
    confidence: number;
    marketPosition: string | null;
    algorithmVersion: string;
    latencyMs: number | null;
    createdAt: string;
  }>;
  feedbackStats: {
    total: number;
    accepted: number;
    completed: number;
    withinRange: number;
  };
  marketSnapshots: Array<{
    categoryKey: string;
    regionKey: string;
    avgPrice: number | null;
    demandIndex: number;
    acceptanceRate: number | null;
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

export async function getAdminPricingDashboard(): Promise<AdminPricingDashboard> {
  const admin = createAdminClient();

  let weights = DEFAULT_PRICING_WEIGHTS;
  try {
    const { data } = await admin
      .from("pricing_weights")
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

  let recentHistory: AdminPricingDashboard["recentHistory"] = [];
  try {
    const { data } = await admin
      .from("pricing_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    recentHistory = (data ?? []).map((h) => ({
      id: h.id,
      categoryKey: h.category_key,
      suggestedMin: Number(h.suggested_min),
      suggestedAvg: Number(h.suggested_avg),
      suggestedPremium: Number(h.suggested_premium),
      confidence: Number(h.confidence),
      marketPosition: h.market_position,
      algorithmVersion: h.algorithm_version,
      latencyMs: h.latency_ms,
      createdAt: h.created_at,
    }));
  } catch {
    /* empty */
  }

  const feedbackStats = {
    total: 0,
    accepted: 0,
    completed: 0,
    withinRange: 0,
  };
  try {
    const { data } = await admin
      .from("pricing_feedback")
      .select("accepted, completed, within_suggested_range")
      .limit(500);
    for (const f of data ?? []) {
      feedbackStats.total += 1;
      if (f.accepted) feedbackStats.accepted += 1;
      if (f.completed) feedbackStats.completed += 1;
      if (f.within_suggested_range) feedbackStats.withinRange += 1;
    }
  } catch {
    /* empty */
  }

  let marketSnapshots: AdminPricingDashboard["marketSnapshots"] = [];
  try {
    const { data } = await admin
      .from("pricing_market_data")
      .select("*")
      .order("computed_at", { ascending: false })
      .limit(20);
    marketSnapshots = (data ?? []).map((m) => ({
      categoryKey: m.category_key,
      regionKey: m.region_key,
      avgPrice: m.avg_price != null ? Number(m.avg_price) : null,
      demandIndex: Number(m.demand_index),
      acceptanceRate:
        m.acceptance_rate != null ? Number(m.acceptance_rate) : null,
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

  let experiment: AdminPricingDashboard["experiment"] = null;
  try {
    const { data } = await admin
      .from("pricing_experiments")
      .select("*")
      .eq("experiment_key", "pricing_default")
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
    recentHistory,
    feedbackStats,
    marketSnapshots,
    avgLatencyMs,
    experiment,
    modelVersion: PRICING_MODEL_VERSION,
  };
}

export async function getPricingHistoryReplay(historyId: string): Promise<{
  public: {
    suggestedMin: number;
    suggestedAvg: number;
    suggestedPremium: number;
    confidence: number;
    marketPosition: string | null;
    algorithmVersion: string;
  };
  explanations: Array<{ code: string; labelEn: string; labelAr: string | null }>;
  signalBreakdown: Record<string, unknown>;
  latencyMs: number | null;
} | null> {
  try {
    const admin = createAdminClient();
    const { data: h } = await admin
      .from("pricing_history")
      .select("*")
      .eq("id", historyId)
      .maybeSingle();
    if (!h) return null;

    const { data: expl } = await admin
      .from("pricing_explanations")
      .select("code, label_en, label_ar")
      .eq("history_id", historyId);

    return {
      public: {
        suggestedMin: Number(h.suggested_min),
        suggestedAvg: Number(h.suggested_avg),
        suggestedPremium: Number(h.suggested_premium),
        confidence: Number(h.confidence),
        marketPosition: h.market_position,
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
