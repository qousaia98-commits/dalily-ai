import { createAdminClient } from "@/lib/supabase/admin";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";

export type LearningAnalytics = {
  totalEvents: number;
  eventsLast7Days: number;
  providersScored: number;
  avgPerformanceScore: number | null;
  avgDataQuality: number | null;
  preferenceProfiles: number;
  topPerformers: Array<{
    providerId: string;
    name: string;
    score: number;
    sampleSize: number;
    completionRate: number | null;
  }>;
  fastestResponders: Array<{
    providerId: string;
    name: string;
    avgResponseHours: number;
    sampleSize: number;
  }>;
  highestCompletion: Array<{
    providerId: string;
    name: string;
    completionRate: number;
    sampleSize: number;
  }>;
  highestRepeat: Array<{
    providerId: string;
    name: string;
    repeatRate: number;
    sampleSize: number;
  }>;
  eventBreakdown: Array<{ eventType: string; count: number }>;
  /** Chosen / shown when both available — rough accuracy proxy */
  recommendationAccuracy: number | null;
};

function providerName(
  name: { ar?: string; en?: string } | null | undefined,
  locale: Locale,
): string {
  if (!name) return "—";
  return getLocalizedText(name as { ar: string; en: string }, locale) || "—";
}

/**
 * Internal Learning AI dashboard data — admin only.
 * Never exposes raw scores to customers.
 */
export async function getLearningAnalytics(
  locale: Locale = "en",
): Promise<LearningAnalytics> {
  const empty: LearningAnalytics = {
    totalEvents: 0,
    eventsLast7Days: 0,
    providersScored: 0,
    avgPerformanceScore: null,
    avgDataQuality: null,
    preferenceProfiles: 0,
    topPerformers: [],
    fastestResponders: [],
    highestCompletion: [],
    highestRepeat: [],
    eventBreakdown: [],
    recommendationAccuracy: null,
  };

  try {
    const admin = createAdminClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalEvents },
      { count: eventsLast7Days },
      { data: scores },
      { count: preferenceProfiles },
      { data: recentEvents },
      { count: shownCount },
      { count: chosenCount },
    ] = await Promise.all([
      admin.from("learning_events").select("id", { count: "exact", head: true }),
      admin
        .from("learning_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      admin
        .from("provider_performance_scores")
        .select("*")
        .order("performance_score", { ascending: false })
        .limit(50),
      admin
        .from("customer_preference_profiles")
        .select("customer_id", { count: "exact", head: true }),
      admin
        .from("learning_events")
        .select("event_type")
        .gte("created_at", weekAgo)
        .limit(2000),
      admin
        .from("learning_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "recommendation_shown")
        .gte("created_at", weekAgo),
      admin
        .from("learning_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "recommendation_chosen")
        .gte("created_at", weekAgo),
    ]);

    const scoreRows = scores ?? [];
    const providerIds = scoreRows.map((s) => s.provider_id);
    const { data: providers } =
      providerIds.length > 0
        ? await admin.from("providers").select("id, name").in("id", providerIds)
        : { data: [] as { id: string; name: { ar: string; en: string } }[] };

    const nameById = new Map(
      (providers ?? []).map((p) => [p.id, providerName(p.name, locale)]),
    );

    const withSample = scoreRows.filter((s) => s.sample_size >= 1);
    const avgPerformanceScore =
      withSample.length > 0
        ? withSample.reduce((a, s) => a + Number(s.performance_score), 0) /
          withSample.length
        : null;
    const avgDataQuality =
      withSample.length > 0
        ? withSample.reduce((a, s) => a + Number(s.data_quality), 0) /
          withSample.length
        : null;

    const breakdownMap = new Map<string, number>();
    for (const e of recentEvents ?? []) {
      breakdownMap.set(e.event_type, (breakdownMap.get(e.event_type) ?? 0) + 1);
    }

    const recommendationAccuracy =
      (shownCount ?? 0) > 0
        ? Math.round(((chosenCount ?? 0) / (shownCount ?? 1)) * 1000) / 10
        : null;

    return {
      totalEvents: totalEvents ?? 0,
      eventsLast7Days: eventsLast7Days ?? 0,
      providersScored: scoreRows.length,
      avgPerformanceScore:
        avgPerformanceScore == null
          ? null
          : Math.round(avgPerformanceScore * 1000) / 1000,
      avgDataQuality:
        avgDataQuality == null ? null : Math.round(avgDataQuality * 1000) / 1000,
      preferenceProfiles: preferenceProfiles ?? 0,
      topPerformers: scoreRows
        .filter((s) => s.sample_size >= 3)
        .slice(0, 8)
        .map((s) => ({
          providerId: s.provider_id,
          name: nameById.get(s.provider_id) ?? "—",
          score: Number(s.performance_score),
          sampleSize: s.sample_size,
          completionRate:
            s.completion_rate == null ? null : Number(s.completion_rate),
        })),
      fastestResponders: [...scoreRows]
        .filter((s) => s.avg_response_hours != null && s.sample_size >= 3)
        .sort(
          (a, b) => Number(a.avg_response_hours) - Number(b.avg_response_hours),
        )
        .slice(0, 8)
        .map((s) => ({
          providerId: s.provider_id,
          name: nameById.get(s.provider_id) ?? "—",
          avgResponseHours: Number(s.avg_response_hours),
          sampleSize: s.sample_size,
        })),
      highestCompletion: [...scoreRows]
        .filter((s) => s.completion_rate != null && s.sample_size >= 3)
        .sort((a, b) => Number(b.completion_rate) - Number(a.completion_rate))
        .slice(0, 8)
        .map((s) => ({
          providerId: s.provider_id,
          name: nameById.get(s.provider_id) ?? "—",
          completionRate: Number(s.completion_rate),
          sampleSize: s.sample_size,
        })),
      highestRepeat: [...scoreRows]
        .filter((s) => s.repeat_customer_rate != null && s.sample_size >= 3)
        .sort(
          (a, b) =>
            Number(b.repeat_customer_rate) - Number(a.repeat_customer_rate),
        )
        .slice(0, 8)
        .map((s) => ({
          providerId: s.provider_id,
          name: nameById.get(s.provider_id) ?? "—",
          repeatRate: Number(s.repeat_customer_rate),
          sampleSize: s.sample_size,
        })),
      eventBreakdown: [...breakdownMap.entries()]
        .map(([eventType, count]) => ({ eventType, count }))
        .sort((a, b) => b.count - a.count),
      recommendationAccuracy,
    };
  } catch {
    return empty;
  }
}
