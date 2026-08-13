/**
 * Aggregated marketplace insights (no PII).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketInsightBundle } from "./types";

export async function buildMarketInsights(): Promise<MarketInsightBundle> {
  const empty: MarketInsightBundle = {
    version: 8,
    mostRequestedServices: [],
    fastestGrowingCategories: [],
    averageCompletionMinutes: null,
    providerUtilizationPct: null,
    regionalDemand: [],
    peakHours: [],
    predictionAccuracyPct: null,
  };

  try {
    const admin = createAdminClient();
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

    const [{ data: recent }, { data: prior }, { data: cats }, { data: cities }] =
      await Promise.all([
        admin
          .from("service_requests")
          .select("created_at, category_id, city_id, completion_time_seconds, status")
          .gte("created_at", weekAgo.toISOString())
          .limit(5000),
        admin
          .from("service_requests")
          .select("category_id")
          .gte("created_at", twoWeeksAgo.toISOString())
          .lt("created_at", weekAgo.toISOString())
          .limit(5000),
        admin.from("categories").select("id, slug").limit(500),
        admin.from("cities").select("id, slug, name").eq("is_active", true).limit(200),
      ]);

    const catMap = new Map(
      (cats ?? []).map((c) => [c.id as string, (c.slug as string) || "unknown"]),
    );
    const cityMap = new Map(
      (cities ?? []).map((c) => [
        c.id as string,
        (c.slug as string) || String(c.id).slice(0, 8),
      ]),
    );

    const recentCounts = new Map<string, number>();
    const priorCounts = new Map<string, number>();
    const cityCounts = new Map<string | null, number>();
    const hourCounts = new Map<number, number>();
    const completionMins: number[] = [];

    for (const r of recent ?? []) {
      const slug = catMap.get(r.category_id as string) ?? "unknown";
      recentCounts.set(slug, (recentCounts.get(slug) ?? 0) + 1);
      const cityId = (r.city_id as string | null) ?? null;
      cityCounts.set(cityId, (cityCounts.get(cityId) ?? 0) + 1);
      const hour = new Date(r.created_at as string).getUTCHours();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      if (r.completion_time_seconds != null) {
        completionMins.push(Number(r.completion_time_seconds) / 60);
      }
    }

    for (const r of prior ?? []) {
      const slug = catMap.get(r.category_id as string) ?? "unknown";
      priorCounts.set(slug, (priorCounts.get(slug) ?? 0) + 1);
    }

    const mostRequestedServices = Array.from(recentCounts.entries())
      .map(([categorySlug, count]) => ({ categorySlug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const fastestGrowingCategories = Array.from(recentCounts.entries())
      .map(([categorySlug, count]) => {
        const prev = priorCounts.get(categorySlug) ?? 0;
        const growthPct =
          prev === 0 ? (count > 0 ? 100 : 0) : Math.round(((count - prev) / prev) * 100);
        return { categorySlug, growthPct };
      })
      .sort((a, b) => b.growthPct - a.growthPct)
      .slice(0, 5);

    const averageCompletionMinutes =
      completionMins.length > 0
        ? Math.round(
            completionMins.reduce((a, b) => a + b, 0) / completionMins.length,
          )
        : null;

    // Utilization proxy: completed / (completed + pending) last week
    const completed = (recent ?? []).filter((r) =>
      ["completed", "confirmed", "reviewed"].includes(String(r.status)),
    ).length;
    const pending = (recent ?? []).filter((r) => r.status === "pending").length;
    const providerUtilizationPct =
      completed + pending > 0
        ? Math.round((completed / (completed + pending)) * 100)
        : null;

    const regionalDemand = Array.from(cityCounts.entries())
      .map(([cityId, count]) => ({
        cityId,
        cityLabel: cityId ? cityMap.get(cityId) ?? "city" : "unknown",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const peakHours = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    let predictionAccuracyPct: number | null = null;
    try {
      const { data: outcomes } = await admin
        .from("ai_prediction_outcomes")
        .select("was_correct")
        .not("was_correct", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (outcomes?.length) {
        const ok = outcomes.filter((o) => o.was_correct).length;
        predictionAccuracyPct = Math.round((ok / outcomes.length) * 100);
      }
    } catch {
      predictionAccuracyPct = null;
    }

    return {
      version: 8,
      mostRequestedServices,
      fastestGrowingCategories,
      averageCompletionMinutes,
      providerUtilizationPct,
      regionalDemand,
      peakHours,
      predictionAccuracyPct,
    };
  } catch {
    return empty;
  }
}
