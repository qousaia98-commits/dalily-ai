/**
 * Admin matching center queries.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_MATCHING_WEIGHTS } from "@/lib/matching-engine/weights";
import type { MatchWeight } from "@/lib/matching-engine/types";
import { MATCHING_MODEL_VERSION } from "@/lib/matching-engine/types";

export type AdminMatchingDashboard = {
  weights: MatchWeight[];
  recentHistory: Array<{
    id: string;
    requestId: string | null;
    algorithmVersion: string;
    latencyMs: number | null;
    providerCount: number;
    createdAt: string;
  }>;
  feedbackStats: {
    total: number;
    accepted: number;
    completed: number;
    complaints: number;
    repeats: number;
  };
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

export async function getAdminMatchingDashboard(): Promise<AdminMatchingDashboard> {
  const admin = createAdminClient();

  let weights = DEFAULT_MATCHING_WEIGHTS;
  try {
    const { data } = await admin.from("matching_weights").select("*").order("signal_key");
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

  let recentHistory: AdminMatchingDashboard["recentHistory"] = [];
  try {
    const { data } = await admin
      .from("matching_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    recentHistory = (data ?? []).map((h) => ({
      id: h.id,
      requestId: h.request_id,
      algorithmVersion: h.algorithm_version,
      latencyMs: h.latency_ms,
      providerCount: Array.isArray(h.provider_ids) ? h.provider_ids.length : 0,
      createdAt: h.created_at,
    }));
  } catch {
    /* empty */
  }

  const feedbackStats = {
    total: 0,
    accepted: 0,
    completed: 0,
    complaints: 0,
    repeats: 0,
  };
  try {
    const { data } = await admin
      .from("matching_feedback")
      .select("accepted, completed, complaint, repeat_booking")
      .limit(500);
    for (const f of data ?? []) {
      feedbackStats.total += 1;
      if (f.accepted) feedbackStats.accepted += 1;
      if (f.completed) feedbackStats.completed += 1;
      if (f.complaint) feedbackStats.complaints += 1;
      if (f.repeat_booking) feedbackStats.repeats += 1;
    }
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

  let experiment: AdminMatchingDashboard["experiment"] = null;
  try {
    const { data } = await admin
      .from("matching_experiments")
      .select("*")
      .eq("experiment_key", "smart_match_default")
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
    avgLatencyMs,
    experiment,
    modelVersion: MATCHING_MODEL_VERSION,
  };
}
