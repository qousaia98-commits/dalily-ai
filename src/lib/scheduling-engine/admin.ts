/**
 * Admin scheduling center queries.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHEDULE_WEIGHTS } from "@/lib/scheduling-engine/weights";
import {
  SCHEDULE_MODEL_VERSION,
  type ScheduleWeight,
} from "@/lib/scheduling-engine/types";

export type AdminScheduleDashboard = {
  weights: ScheduleWeight[];
  profiles: Array<{
    profileKey: string;
    title: string;
    goal: string;
    enabled: boolean;
    mlReady: boolean;
    isDefault: boolean;
  }>;
  recentHistory: Array<{
    id: string;
    providerId: string | null;
    scheduleDate: string | null;
    utilization: number | null;
    travelMinutes: number | null;
    idleMinutes: number | null;
    algorithmVersion: string;
    latencyMs: number | null;
    createdAt: string;
  }>;
  opportunityStats: {
    suggested: number;
    accepted: number;
    ignored: number;
    captureRate: number | null;
  };
  avgUtilization: number | null;
  avgIdleMinutes: number | null;
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

export async function getAdminScheduleDashboard(): Promise<AdminScheduleDashboard> {
  const admin = createAdminClient();

  let weights = DEFAULT_SCHEDULE_WEIGHTS;
  try {
    const { data } = await admin
      .from("schedule_signal_weights")
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

  let profiles: AdminScheduleDashboard["profiles"] = [];
  try {
    const { data } = await admin.from("schedule_profiles").select("*").order("profile_key");
    profiles = (data ?? []).map((p) => ({
      profileKey: p.profile_key,
      title: p.title,
      goal: p.optimization_goal,
      enabled: p.enabled,
      mlReady: p.ml_ready,
      isDefault: p.is_default,
    }));
  } catch {
    /* empty */
  }

  let recentHistory: AdminScheduleDashboard["recentHistory"] = [];
  try {
    const { data } = await admin
      .from("schedule_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    recentHistory = (data ?? []).map((h) => ({
      id: h.id,
      providerId: h.provider_id,
      scheduleDate: h.schedule_date,
      utilization: h.utilization != null ? Number(h.utilization) : null,
      travelMinutes: h.travel_minutes != null ? Number(h.travel_minutes) : null,
      idleMinutes: h.idle_minutes != null ? Number(h.idle_minutes) : null,
      algorithmVersion: h.algorithm_version,
      latencyMs: h.latency_ms,
      createdAt: h.created_at,
    }));
  } catch {
    /* empty */
  }

  const opportunityStats = {
    suggested: 0,
    accepted: 0,
    ignored: 0,
    captureRate: null as number | null,
  };
  try {
    const { data } = await admin
      .from("provider_opportunities")
      .select("status")
      .limit(500);
    for (const o of data ?? []) {
      if (o.status === "suggested") opportunityStats.suggested += 1;
      if (o.status === "accepted") opportunityStats.accepted += 1;
      if (o.status === "ignored") opportunityStats.ignored += 1;
    }
    const decided = opportunityStats.accepted + opportunityStats.ignored;
    if (decided > 0) {
      opportunityStats.captureRate =
        Math.round((opportunityStats.accepted / decided) * 1000) / 1000;
    }
  } catch {
    /* empty */
  }

  const utils = recentHistory
    .map((h) => h.utilization)
    .filter((n): n is number => typeof n === "number");
  const idles = recentHistory
    .map((h) => h.idleMinutes)
    .filter((n): n is number => typeof n === "number");
  const latencies = recentHistory
    .map((h) => h.latencyMs)
    .filter((n): n is number => typeof n === "number");

  let experiment: AdminScheduleDashboard["experiment"] = null;
  try {
    const { data } = await admin
      .from("schedule_experiments")
      .select("*")
      .eq("experiment_key", "schedule_default")
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
    profiles,
    recentHistory,
    opportunityStats,
    avgUtilization:
      utils.length > 0
        ? Math.round((utils.reduce((a, b) => a + b, 0) / utils.length) * 1000) /
          1000
        : null,
    avgIdleMinutes:
      idles.length > 0
        ? Math.round(idles.reduce((a, b) => a + b, 0) / idles.length)
        : null,
    avgLatencyMs:
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
    experiment,
    modelVersion: SCHEDULE_MODEL_VERSION,
  };
}

export async function getScheduleHistoryReplay(historyId: string): Promise<{
  public: Record<string, unknown>;
  explanations: Array<{ code: string; labelEn: string; labelAr: string | null }>;
  signalBreakdown: Record<string, unknown>;
  latencyMs: number | null;
} | null> {
  try {
    const admin = createAdminClient();
    const { data: h } = await admin
      .from("schedule_history")
      .select("*")
      .eq("id", historyId)
      .maybeSingle();
    if (!h) return null;
    const { data: expl } = await admin
      .from("schedule_explanations")
      .select("code, label_en, label_ar")
      .eq("history_id", historyId);
    return {
      public: (h.optimized_payload ?? {}) as Record<string, unknown>,
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
