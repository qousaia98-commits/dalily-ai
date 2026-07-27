/**
 * Private provider reputation insights (owner + admin only).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ProviderReputationInsights,
  TrustLevel,
  ReputationTrend,
} from "@/lib/reputation/types";

export async function getProviderReputationInsights(
  providerId: string,
  locale: "en" | "ar" = "en",
): Promise<ProviderReputationInsights | null> {
  const admin = createAdminClient();

  const [{ data: score }, { data: explanations }, { data: history }, rawMetrics] =
    await Promise.all([
      admin
        .from("provider_reputation_scores")
        .select("internal_score, trust_level, trend")
        .eq("provider_id", providerId)
        .maybeSingle(),
      admin
        .from("provider_reputation_explanations")
        .select("body, polarity, audience, locale, explanation_key")
        .eq("provider_id", providerId)
        .eq("locale", locale)
        .in("audience", ["provider", "public"]),
      admin
        .from("provider_reputation_history")
        .select("period, trust_level, internal_score, created_at")
        .eq("provider_id", providerId)
        .in("period", ["monthly", "snapshot", "weekly"])
        .order("created_at", { ascending: false })
        .limit(6),
      loadMetrics(providerId),
    ]);

  if (!score) return null;

  const strengths = (explanations ?? [])
    .filter((e) => e.audience === "public" && e.polarity === "positive")
    .map((e) => e.body)
    .slice(0, 5);

  const improvements = (explanations ?? [])
    .filter((e) => e.audience === "provider" && e.polarity === "improvement")
    .map((e) => e.body)
    .slice(0, 5);

  return {
    providerId,
    trustLevel: score.trust_level as TrustLevel,
    trend: score.trend as ReputationTrend,
    internalScore: Number(score.internal_score),
    strengths,
    improvements,
    suggestions: improvements,
    metrics: rawMetrics,
    monthlyTrend: (history ?? [])
      .slice()
      .reverse()
      .map((h) => ({
        period: h.period,
        trustLevel: h.trust_level as TrustLevel,
        score: Number(h.internal_score),
        at: h.created_at,
      })),
  };
}

async function loadMetrics(providerId: string) {
  try {
    const supabase = await createClient();
    const [{ data: cache }, { data: perf }, { count }] = await Promise.all([
      supabase
        .from("provider_reputation_cache")
        .select("recommendation_rate")
        .eq("provider_id", providerId)
        .maybeSingle(),
      supabase
        .from("provider_performance_scores")
        .select("cancellation_rate, avg_response_hours, successful_jobs")
        .eq("provider_id", providerId)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .in("status", ["completed", "customer_confirmed"]),
    ]);

    return {
      completedJobs: count ?? Number(perf?.successful_jobs ?? 0),
      cancellationRate:
        perf?.cancellation_rate != null ? Number(perf.cancellation_rate) : null,
      responseTimeHours:
        perf?.avg_response_hours != null ? Number(perf.avg_response_hours) : null,
      recommendationRate:
        cache?.recommendation_rate != null
          ? Number(cache.recommendation_rate)
          : null,
    };
  } catch {
    return {
      completedJobs: 0,
      cancellationRate: null,
      responseTimeHours: null,
      recommendationRate: null,
    };
  }
}
