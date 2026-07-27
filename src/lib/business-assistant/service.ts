/**
 * Business assistant service — overview, briefing, goals, recommendations.
 * Providers always remain in control.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { collectBusinessRaw } from "@/lib/business-assistant/collect";
import { computeAnonymousBenchmark } from "@/lib/business-assistant/benchmarks";
import {
  generateGrowthOpportunities,
  generateInsights,
  generateMorningBriefing,
  generateRecommendations,
} from "@/lib/business-assistant/insights";
import { trackBusinessAssistantEvent } from "@/lib/business-assistant/observability";
import { isAiBusinessAssistantEnabled } from "@/lib/config/feature-flags";
import {
  BUSINESS_MODEL_VERSION,
  type BusinessGoal,
  type BusinessGoalType,
  type ProviderBusinessAssistant,
} from "@/lib/business-assistant/types";
import type { Json } from "@/types/database.types";

const DASH_CACHE = new Map<
  string,
  { at: number; data: ProviderBusinessAssistant }
>();
const DASH_TTL_MS = 2 * 60_000;

export async function getProviderBusinessAssistant(input: {
  providerId: string;
  persist?: boolean;
  skipCache?: boolean;
}): Promise<ProviderBusinessAssistant | null> {
  if (!isAiBusinessAssistantEnabled()) return null;

  if (!input.skipCache) {
    const hit = DASH_CACHE.get(input.providerId);
    if (hit && Date.now() - hit.at < DASH_TTL_MS) return hit.data;
  }

  const started = Date.now();
  const raw = await collectBusinessRaw(input.providerId);
  const insights = generateInsights(raw);
  const recommendations = generateRecommendations(raw);
  const growth = generateGrowthOpportunities(raw);
  const briefing = generateMorningBriefing(raw);
  const benchmark = computeAnonymousBenchmark(raw);
  const goals = await listProviderGoals(input.providerId);

  const overview = {
    revenue: raw.revenue,
    bookings: raw.bookings,
    acceptanceRate: raw.acceptanceRate,
    completionRate: raw.completionRate,
    cancellationRate: raw.cancellationRate,
    responseTimeMin: raw.responseTimeMin,
    customerSatisfaction: raw.customerSatisfaction,
    trustLevel: raw.trustLevel,
    reputationTrend: raw.reputationTrend,
    capacityUsage: raw.capacityUsage,
    businessHealthScore: raw.businessHealthScore,
    currency: raw.currency,
  };

  const data: ProviderBusinessAssistant = {
    overview,
    briefing,
    insights,
    recommendations,
    growth,
    goals,
    benchmark,
    algorithmVersion: BUSINESS_MODEL_VERSION,
    latencyMs: Date.now() - started,
  };

  DASH_CACHE.set(input.providerId, { at: Date.now(), data });

  void trackBusinessAssistantEvent("insight_generated", {
    providerId: input.providerId,
    count: insights.length,
  });
  void trackBusinessAssistantEvent("briefing_generated", {
    providerId: input.providerId,
  });
  void trackBusinessAssistantEvent("business_health_updated", {
    providerId: input.providerId,
    health: overview.businessHealthScore,
  });
  void trackBusinessAssistantEvent("latency", { latencyMs: data.latencyMs });

  if (input.persist !== false) {
    void persistAssistantSnapshot({
      providerId: input.providerId,
      data,
      insights,
      recommendations,
      briefing,
      benchmark,
      overview,
    });
  }

  // Attach DB recommendation ids when available (own provider only)
  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("business_recommendations")
      .select("id, code")
      .eq("provider_id", input.providerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);
    if (rows?.length) {
      data.recommendations = data.recommendations.map((r) => {
        const match = rows.find((row) => row.code === r.code);
        return match ? { ...r, id: match.id } : r;
      });
    }
  } catch {
    /* soft */
  }

  return data;
}

async function persistAssistantSnapshot(input: {
  providerId: string;
  data: ProviderBusinessAssistant;
  insights: ProviderBusinessAssistant["insights"];
  recommendations: ProviderBusinessAssistant["recommendations"];
  briefing: NonNullable<ProviderBusinessAssistant["briefing"]>;
  benchmark: NonNullable<ProviderBusinessAssistant["benchmark"]>;
  overview: ProviderBusinessAssistant["overview"];
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("business_health").upsert(
      {
        provider_id: input.providerId,
        health_score: input.overview.businessHealthScore,
        revenue_score: Math.min(1, input.overview.revenue / 5_000_000),
        booking_score: Math.min(1, input.overview.bookings / 40),
        quality_score: input.overview.customerSatisfaction ?? 0.6,
        trust_score: input.overview.trustLevel,
        capacity_score: input.overview.capacityUsage,
        trend: input.overview.reputationTrend,
        metrics: input.overview as unknown as Json,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "provider_id" },
    );

    await admin.from("business_briefings").upsert(
      {
        provider_id: input.providerId,
        briefing_date: input.briefing.briefingDate,
        summary_en: input.briefing.summaryEn,
        summary_ar: input.briefing.summaryAr ?? null,
        sections: input.briefing as unknown as Json,
        algorithm_version: input.briefing.algorithmVersion,
      },
      { onConflict: "provider_id,briefing_date" },
    );

    await admin.from("business_benchmarks").upsert(
      {
        provider_id: input.providerId,
        region_key: input.benchmark.regionKey,
        category_key: input.benchmark.categoryKey,
        cohort: input.benchmark.cohort,
        percentile: input.benchmark.percentile,
        metrics: { health: input.overview.businessHealthScore } as Json,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "provider_id,region_key,category_key" },
    );

    for (const i of input.insights.slice(0, 5)) {
      await admin.from("business_insights").insert({
        provider_id: input.providerId,
        code: i.code,
        category: i.category,
        label_en: i.labelEn,
        label_ar: i.labelAr ?? null,
        severity: i.severity,
        algorithm_version: BUSINESS_MODEL_VERSION,
      });
    }

    for (const r of input.recommendations.slice(0, 5)) {
      await admin.from("business_recommendations").insert({
        provider_id: input.providerId,
        code: r.code,
        title_en: r.titleEn,
        title_ar: r.titleAr ?? null,
        body_en: r.bodyEn ?? null,
        body_ar: r.bodyAr ?? null,
        priority: r.priority,
        status: "pending",
        algorithm_version: BUSINESS_MODEL_VERSION,
      });
    }
  } catch {
    /* soft until migration */
  }
}

export async function listProviderGoals(
  providerId: string,
): Promise<BusinessGoal[]> {
  if (!isAiBusinessAssistantEnabled()) return [];
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("business_goals")
      .select("*")
      .eq("provider_id", providerId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((g) => {
      const target = Number(g.target_value);
      const current = Number(g.current_value);
      const progressPct =
        target > 0 ? Math.min(1, Math.round((current / target) * 1000) / 1000) : 0;
      return {
        id: g.id,
        goalType: g.goal_type as BusinessGoalType,
        title: g.title,
        targetValue: target,
        currentValue: current,
        unit: g.unit,
        period: g.period,
        progressPct,
        active: g.active,
      };
    });
  } catch {
    return [];
  }
}

export async function upsertBusinessGoal(input: {
  providerId: string;
  goalId?: string;
  goalType: BusinessGoalType;
  title: string;
  targetValue: number;
  currentValue?: number;
  unit?: string | null;
  period?: string;
}): Promise<BusinessGoal | null> {
  if (!isAiBusinessAssistantEnabled()) return null;
  try {
    const admin = createAdminClient();
    const current = input.currentValue ?? 0;
    if (input.goalId) {
      await admin
        .from("business_goals")
        .update({
          title: input.title,
          target_value: input.targetValue,
          current_value: current,
          unit: input.unit ?? null,
          period: input.period ?? "monthly",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.goalId)
        .eq("provider_id", input.providerId);
    } else {
      const { data } = await admin
        .from("business_goals")
        .insert({
          provider_id: input.providerId,
          goal_type: input.goalType,
          title: input.title,
          target_value: input.targetValue,
          current_value: current,
          unit: input.unit ?? null,
          period: input.period ?? "monthly",
          active: true,
        })
        .select("*")
        .single();
      if (!data) return null;
      input.goalId = data.id;
    }

    const progressPct =
      input.targetValue > 0
        ? Math.min(1, current / input.targetValue)
        : 0;
    if (input.goalId) {
      await admin.from("business_goal_progress").insert({
        goal_id: input.goalId,
        provider_id: input.providerId,
        recorded_value: current,
        progress_pct: progressPct,
      });
      if (progressPct >= 1) {
        void trackBusinessAssistantEvent("goal_achieved", {
          providerId: input.providerId,
          goalId: input.goalId,
        });
      }
    }

    const goals = await listProviderGoals(input.providerId);
    return goals.find((g) => g.id === input.goalId) ?? null;
  } catch {
    return null;
  }
}

export async function decideRecommendation(input: {
  recommendationId: string;
  providerId: string;
  accept: boolean;
}): Promise<boolean> {
  if (!isAiBusinessAssistantEnabled()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("business_recommendations")
      .update({
        status: input.accept ? "accepted" : "dismissed",
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.recommendationId)
      .eq("provider_id", input.providerId);
    if (input.accept) {
      void trackBusinessAssistantEvent("recommendation_accepted", {
        providerId: input.providerId,
        recommendationId: input.recommendationId,
      });
    }
    return !error;
  } catch {
    return false;
  }
}

export function invalidateBusinessAssistantCache(providerId?: string): void {
  if (!providerId) {
    DASH_CACHE.clear();
    return;
  }
  DASH_CACHE.delete(providerId);
}
