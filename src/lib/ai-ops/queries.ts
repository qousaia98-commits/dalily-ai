/**
 * AI Ops dashboard queries.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { collectLivePlatformCounters } from "@/lib/ai-ops/collect";
import { buildHealthSnapshot } from "@/lib/ai-ops/health";
import { generateAiOpsInsights } from "@/lib/ai-ops/insights";
import {
  mapAlert,
  mapAnomaly,
  mapCategoryHealth,
  mapRegionHealth,
  mapTask,
  mapTrend,
} from "@/lib/ai-ops/map";
import { computeTrendsFromCounters } from "@/lib/ai-ops/trends";
import type {
  AiOpsInsight,
  CategoryHealth,
  OpsTask,
  PlatformAlert,
  PlatformAnomaly,
  PlatformHealthSnapshot,
  PlatformTrend,
  RegionHealth,
} from "@/lib/ai-ops/types";

export type AiOpsDashboard = {
  health: PlatformHealthSnapshot;
  insights: AiOpsInsight[];
  alerts: PlatformAlert[];
  anomalies: PlatformAnomaly[];
  trends: PlatformTrend[];
  categories: CategoryHealth[];
  regions: RegionHealth[];
  tasks: OpsTask[];
};

export async function getAiOpsDashboard(): Promise<AiOpsDashboard> {
  const admin = createAdminClient();
  const counters = await collectLivePlatformCounters();
  const health = buildHealthSnapshot(counters);
  const trendDrafts = computeTrendsFromCounters(counters);
  const insights = generateAiOpsInsights({
    counters,
    health,
    trends: trendDrafts,
  });

  const [alerts, anomalies, trends, categories, regions, tasks] =
    await Promise.all([
      admin
        .from("platform_alerts")
        .select("*")
        .in("status", ["open", "acknowledged"])
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("platform_anomalies")
        .select("*")
        .eq("false_positive", false)
        .is("resolved_at", null)
        .order("detected_at", { ascending: false })
        .limit(30),
      admin
        .from("platform_trends")
        .select("*")
        .eq("period", "weekly")
        .order("computed_at", { ascending: false })
        .limit(40),
      admin
        .from("category_health")
        .select("*")
        .order("health_score", { ascending: false })
        .limit(20),
      admin
        .from("region_health")
        .select("*")
        .order("health_score", { ascending: false })
        .limit(20),
      admin
        .from("platform_ops_tasks")
        .select("*")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return {
    health,
    insights,
    alerts: (alerts.data ?? []).map(mapAlert),
    anomalies: (anomalies.data ?? []).map(mapAnomaly),
    trends: (trends.data ?? []).length
      ? (trends.data ?? []).map(mapTrend)
      : trendDrafts
          .filter((t) => t.period === "weekly")
          .map((t, i) => ({ ...t, id: `live-${i}` })),
    categories: (categories.data ?? []).map(mapCategoryHealth),
    regions: (regions.data ?? []).map(mapRegionHealth),
    tasks: (tasks.data ?? []).map(mapTask),
  };
}
