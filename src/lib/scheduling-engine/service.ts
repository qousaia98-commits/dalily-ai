/**
 * Scheduling service — optimize day, gaps, opportunities, capacity.
 * Advisory only — provider always decides.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { collectScheduleRaw } from "@/lib/scheduling-engine/collect";
import { computeScheduleFromSignals } from "@/lib/scheduling-engine/engine";
import { detectScheduleGaps } from "@/lib/scheduling-engine/gaps";
import { computeCapacitySnapshot } from "@/lib/scheduling-engine/capacity";
import {
  scoreOpportunities,
  syntheticGapCandidates,
} from "@/lib/scheduling-engine/opportunities";
import { optimizeRoute } from "@/lib/scheduling-engine/routes";
import { trackScheduleEvent } from "@/lib/scheduling-engine/observability";
import {
  DEFAULT_SCHEDULE_WEIGHTS,
  mergeScheduleWeights,
} from "@/lib/scheduling-engine/weights";
import { SCHEDULE_ADVISORY_NOTICE } from "@/lib/scheduling-engine/explanations";
import { isAiSchedulingEnabled } from "@/lib/config/feature-flags";
import {
  SCHEDULE_MODEL_VERSION,
  type CustomerScheduleHint,
  type ProviderScheduleInsights,
  type PublicDayOptimization,
  type ScheduleComputation,
  type ScheduleOpportunity,
  type ScheduleWeight,
} from "@/lib/scheduling-engine/types";
import type { Json } from "@/types/database.types";

const SCHEDULE_CACHE = new Map<
  string,
  { at: number; computation: ScheduleComputation }
>();
const SCHEDULE_TTL_MS = 2 * 60_000;

async function loadWeights(): Promise<ScheduleWeight[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("schedule_signal_weights").select("*");
    if (!data?.length) return DEFAULT_SCHEDULE_WEIGHTS;
    return mergeScheduleWeights(
      DEFAULT_SCHEDULE_WEIGHTS,
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
    return DEFAULT_SCHEDULE_WEIGHTS;
  }
}

async function resolveExperiment(salt?: string | null): Promise<{
  algorithm: string;
  experimentId: string | null;
}> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("schedule_experiments")
      .select("*")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!data) {
      return { algorithm: SCHEDULE_MODEL_VERSION, experimentId: null };
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
    return { algorithm: SCHEDULE_MODEL_VERSION, experimentId: null };
  }
}

export function toPublicDayOptimization(
  c: ScheduleComputation,
): PublicDayOptimization {
  return {
    scheduleDate: c.scheduleDate,
    orderedStops: c.orderedStops,
    departureTime: c.departureTime,
    expectedFinish: c.expectedFinish,
    breakSchedule: c.breakSchedule,
    lunchRecommendation: c.lunchRecommendation,
    travelMinutes: c.travelMinutes,
    idleMinutes: c.idleMinutes,
    travelReductionMin: c.travelReductionMin,
    idleReductionMin: c.idleReductionMin,
    fuelReductionKm: c.fuelReductionKm,
    dailyUtilization: c.dailyUtilization,
    revenueForecast: c.revenueForecast,
    explanations: c.explanations,
    algorithmVersion: c.algorithmVersion,
    advisoryNotice: c.advisoryNotice,
  };
}

export async function optimizeProviderSchedule(input: {
  providerId: string;
  scheduleDate?: string;
  persist?: boolean;
  skipCache?: boolean;
}): Promise<ScheduleComputation | null> {
  if (!isAiSchedulingEnabled()) return null;
  const cacheKey = `${input.providerId}:${input.scheduleDate ?? "today"}`;
  if (!input.skipCache) {
    const hit = SCHEDULE_CACHE.get(cacheKey);
    if (hit && Date.now() - hit.at < SCHEDULE_TTL_MS) return hit.computation;
  }

  const started = Date.now();
  const weights = await loadWeights();
  const experiment = await resolveExperiment(input.providerId);
  const raw = await collectScheduleRaw({
    providerId: input.providerId,
    scheduleDate: input.scheduleDate,
  });
  const computation = computeScheduleFromSignals({
    raw,
    weights,
    experimentId: experiment.experimentId,
    profileKey: experiment.algorithm.includes("ml")
      ? "schedule-ml-v0"
      : "balanced-v1",
    startedAt: started,
    includeMlLayer: experiment.algorithm.includes("ml"),
  });

  SCHEDULE_CACHE.set(cacheKey, { at: Date.now(), computation });

  void trackScheduleEvent("optimization_executed", {
    providerId: input.providerId,
    latencyMs: computation.latencyMs,
    algorithmVersion: computation.algorithmVersion,
  });
  void trackScheduleEvent("latency", { latencyMs: computation.latencyMs });
  if (computation.travelReductionMin > 0) {
    void trackScheduleEvent("travel_reduction", {
      providerId: input.providerId,
      minutes: computation.travelReductionMin,
    });
  }
  if (computation.overbookingRisk >= 0.8 || computation.burnoutRisk >= 0.7) {
    void trackScheduleEvent("capacity_warning", {
      providerId: input.providerId,
      burnoutRisk: computation.burnoutRisk,
      overbookingRisk: computation.overbookingRisk,
    });
  }

  if (input.persist !== false) {
    void persistOptimization(computation);
  }

  return computation;
}

async function persistOptimization(c: ScheduleComputation): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: hist } = await admin
      .from("schedule_history")
      .insert({
        provider_id: c.providerId,
        profile_key: c.profileKey,
        algorithm_version: c.algorithmVersion,
        experiment_id: c.experimentId,
        schedule_date: c.scheduleDate,
        utilization: c.dailyUtilization,
        travel_minutes: c.travelMinutes,
        idle_minutes: c.idleMinutes,
        revenue_forecast: c.revenueForecast,
        burnout_risk: c.burnoutRisk,
        opportunity_score: c.opportunityScore,
        signal_breakdown: Object.fromEntries(
          c.signals.map((s) => [s.signalKey, s.contribution]),
        ) as Json,
        optimized_payload: toPublicDayOptimization(c) as unknown as Json,
        latency_ms: c.latencyMs,
      })
      .select("id")
      .single();

    if (hist?.id) {
      if (c.explanations.length) {
        await admin.from("schedule_explanations").insert(
          c.explanations.map((e) => ({
            history_id: hist.id,
            code: e.code,
            label_en: e.labelEn,
            label_ar: e.labelAr ?? null,
            audience: "provider",
          })),
        );
      }
      await admin.from("schedule_recommendations").insert({
        history_id: hist.id,
        provider_id: c.providerId,
        kind: "day_optimize",
        title_en: "AI optimized day schedule",
        title_ar: "جدول يوم محسّن بالذكاء الاصطناعي",
        payload: toPublicDayOptimization(c) as unknown as Json,
        score: c.opportunityScore,
        status: "pending",
      });

      const capacity = computeCapacitySnapshot(
        await collectScheduleRaw({ providerId: c.providerId, scheduleDate: c.scheduleDate }),
      );
      await admin.from("capacity_history").insert({
        provider_id: c.providerId,
        day: c.scheduleDate,
        max_daily_jobs: capacity.maxDailyJobs,
        max_weekly_jobs: capacity.maxWeeklyJobs,
        jobs_booked: capacity.jobsBooked,
        remaining_capacity: capacity.remainingCapacity,
        available_capacity: capacity.availableCapacity,
        overbooking_risk: capacity.overbookingRisk,
        burnout_risk: capacity.burnoutRisk,
        vacation_mode: capacity.vacationMode,
        pause_mode: capacity.pauseMode,
        workload_score: capacity.workloadScore,
      });
    }
  } catch {
    /* soft until migration */
  }
}

export async function getProviderScheduleInsights(input: {
  providerId: string;
  scheduleDate?: string;
}): Promise<ProviderScheduleInsights> {
  const empty: ProviderScheduleInsights = {
    optimization: null,
    capacity: null,
    gaps: [],
    opportunities: [],
    route: null,
    burnoutRisk: 0,
    opportunityScore: 0,
    utilization: 0,
    currency: "SYP",
  };
  if (!isAiSchedulingEnabled()) return empty;

  const computation = await optimizeProviderSchedule({
    providerId: input.providerId,
    scheduleDate: input.scheduleDate,
    persist: false,
  });
  if (!computation) return empty;

  const raw = await collectScheduleRaw({
    providerId: input.providerId,
    scheduleDate: input.scheduleDate,
  });
  const gaps = detectScheduleGaps(raw.stops);
  const route = optimizeRoute(raw.stops);
  const candidates = syntheticGapCandidates(gaps);
  const opportunities = scoreOpportunities({
    stops: raw.stops,
    gaps,
    candidates,
  });

  // Persist gaps/opportunities soft
  void persistGapsAndOpportunities({
    providerId: input.providerId,
    scheduleDate: computation.scheduleDate,
    gaps,
    opportunities,
  });

  return {
    optimization: toPublicDayOptimization(computation),
    capacity: computeCapacitySnapshot(raw),
    gaps,
    opportunities,
    route: {
      totalDistanceKm: route.totalDistanceKm,
      totalTravelMin: route.totalTravelMin,
      stopOrder: route.stopOrder,
    },
    burnoutRisk: computation.burnoutRisk,
    opportunityScore: computation.opportunityScore,
    utilization: computation.dailyUtilization,
    currency: "SYP",
  };
}

async function persistGapsAndOpportunities(input: {
  providerId: string;
  scheduleDate: string;
  gaps: { startsAt: string; endsAt: string; durationMinutes: number }[];
  opportunities: ScheduleOpportunity[];
}): Promise<void> {
  try {
    const admin = createAdminClient();
    for (const g of input.gaps.slice(0, 5)) {
      await admin.from("provider_schedule_gaps").insert({
        provider_id: input.providerId,
        gap_date: input.scheduleDate,
        starts_at: g.startsAt,
        ends_at: g.endsAt,
        duration_minutes: g.durationMinutes,
        status: "open",
      });
    }
    for (const o of input.opportunities.slice(0, 5)) {
      const { data: row } = await admin
        .from("provider_opportunities")
        .insert({
          provider_id: input.providerId,
          title_en: o.titleEn,
          title_ar: o.titleAr ?? null,
          distance_km: o.distanceKm,
          travel_minutes: o.travelMinutes,
          expected_earnings: o.expectedEarnings,
          expected_duration_min: o.expectedDurationMin,
          matching_score: o.matchingScore,
          opportunity_score: o.opportunityScore,
          currency: o.currency,
          status: "suggested",
          payload: o as unknown as Json,
        })
        .select("id")
        .single();
      if (row?.id) {
        await admin.from("provider_opportunity_history").insert({
          opportunity_id: row.id,
          provider_id: input.providerId,
          action: "shown",
        });
      }
    }
  } catch {
    /* soft */
  }
}

export async function decideScheduleRecommendation(input: {
  recommendationId: string;
  providerId: string;
  accept: boolean;
}): Promise<boolean> {
  if (!isAiSchedulingEnabled()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("schedule_recommendations")
      .update({
        status: input.accept ? "accepted" : "rejected",
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.recommendationId)
      .eq("provider_id", input.providerId);
    void trackScheduleEvent(
      input.accept ? "recommendation_accepted" : "recommendation_rejected",
      { providerId: input.providerId, recommendationId: input.recommendationId },
    );
    return !error;
  } catch {
    return false;
  }
}

export async function decideOpportunity(input: {
  opportunityId: string;
  providerId: string;
  accept: boolean;
}): Promise<boolean> {
  if (!isAiSchedulingEnabled()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("provider_opportunities")
      .update({
        status: input.accept ? "accepted" : "ignored",
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.opportunityId)
      .eq("provider_id", input.providerId);
    await admin.from("provider_opportunity_history").insert({
      opportunity_id: input.opportunityId,
      provider_id: input.providerId,
      action: input.accept ? "accepted" : "ignored",
    });
    void trackScheduleEvent(
      input.accept ? "opportunity_accepted" : "opportunity_ignored",
      { providerId: input.providerId, opportunityId: input.opportunityId },
    );
    if (input.accept) {
      void trackScheduleEvent("revenue_increase", {
        providerId: input.providerId,
      });
    }
    return !error;
  } catch {
    return false;
  }
}

export async function getCustomerScheduleHint(input: {
  providerId?: string | null;
}): Promise<CustomerScheduleHint | null> {
  if (!isAiSchedulingEnabled()) return null;

  if (input.providerId) {
    const insights = await getProviderScheduleInsights({
      providerId: input.providerId,
    });
    const util = insights.utilization;
    return {
      availableWindows:
        util < 0.7
          ? ["Today afternoon", "Tomorrow morning"]
          : ["Tomorrow late morning"],
      arrivalWindow: insights.optimization?.orderedStops[0]
        ? "±10 minutes of scheduled start"
        : null,
      bookingConfidence: Math.round((0.55 + (1 - util) * 0.3) * 1000) / 1000,
      availabilityForecast:
        util >= 0.85 ? "scarce" : util <= 0.4 ? "ample" : "normal",
      explanations: insights.optimization?.explanations ?? [],
      advisoryNotice: SCHEDULE_ADVISORY_NOTICE,
    };
  }

  return {
    availableWindows: ["Morning", "Afternoon"],
    arrivalWindow: "Estimated on confirmation",
    bookingConfidence: 0.6,
    availabilityForecast: "normal",
    explanations: [
      {
        code: "general_availability",
        labelEn: "Typical windows are open — confirm with the provider.",
        labelAr: "النوافذ النموذجية متاحة — أكّد مع المزود.",
      },
    ],
    advisoryNotice: SCHEDULE_ADVISORY_NOTICE,
  };
}

export async function updateScheduleWeight(input: {
  signalKey: string;
  weight: number;
  enabled?: boolean;
}): Promise<boolean> {
  if (!isAiSchedulingEnabled()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("schedule_signal_weights")
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

export async function simulateSchedule(input: {
  providerId: string;
  scheduleDate?: string;
}): Promise<{
  public: PublicDayOptimization;
  latencyMs: number;
  signalCount?: number;
  gaps: number;
  opportunities: number;
} | null> {
  const c = await optimizeProviderSchedule({
    providerId: input.providerId,
    scheduleDate: input.scheduleDate,
    persist: false,
    skipCache: true,
  });
  if (!c) return null;
  const insights = await getProviderScheduleInsights({
    providerId: input.providerId,
    scheduleDate: input.scheduleDate,
  });
  return {
    public: toPublicDayOptimization(c),
    latencyMs: c.latencyMs,
    signalCount: c.signals.length,
    gaps: insights.gaps.length,
    opportunities: insights.opportunities.length,
  };
}

export function invalidateScheduleCache(providerId?: string): void {
  if (!providerId) {
    SCHEDULE_CACHE.clear();
    return;
  }
  for (const key of SCHEDULE_CACHE.keys()) {
    if (key.startsWith(`${providerId}:`)) SCHEDULE_CACHE.delete(key);
  }
}
