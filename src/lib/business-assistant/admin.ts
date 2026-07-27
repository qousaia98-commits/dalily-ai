/**
 * Admin marketplace business insights (aggregated only).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { BUSINESS_MODEL_VERSION } from "@/lib/business-assistant/types";
import type { AdminBusinessInsights } from "@/lib/business-assistant/types";

export async function getAdminBusinessInsights(): Promise<AdminBusinessInsights> {
  const admin = createAdminClient();

  let providerGrowthCount = 0;
  let recentBriefings = 0;
  const healthDistribution = { healthy: 0, average: 0, atRisk: 0 };

  try {
    const { data } = await admin
      .from("business_health")
      .select("health_score")
      .limit(500);
    providerGrowthCount = data?.length ?? 0;
    for (const row of data ?? []) {
      const s = Number(row.health_score);
      if (s >= 0.7) healthDistribution.healthy += 1;
      else if (s >= 0.45) healthDistribution.average += 1;
      else healthDistribution.atRisk += 1;
    }
  } catch {
    /* empty */
  }

  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    const { data } = await admin
      .from("business_briefings")
      .select("id")
      .gte("created_at", since.toISOString())
      .limit(500);
    recentBriefings = data?.length ?? 0;
  } catch {
    /* empty */
  }

  let regionalOpportunities: AdminBusinessInsights["regionalOpportunities"] = [];
  let categoryOpportunities: AdminBusinessInsights["categoryOpportunities"] = [];
  try {
    const { data } = await admin
      .from("forecast_market_snapshots")
      .select("category_key, region_key, demand_index, growing")
      .limit(40);
    for (const m of data ?? []) {
      if (m.growing || Number(m.demand_index) >= 0.55) {
        if (m.region_key !== "all") {
          regionalOpportunities.push({
            regionKey: m.region_key,
            demandIndex: Number(m.demand_index),
          });
        }
        categoryOpportunities.push({
          categoryKey: m.category_key,
          demandIndex: Number(m.demand_index),
        });
      }
    }
    regionalOpportunities = regionalOpportunities.slice(0, 8);
    categoryOpportunities = categoryOpportunities.slice(0, 8);
  } catch {
    /* optional */
  }

  return {
    marketplaceGrowthPct: null,
    providerGrowthCount,
    regionalOpportunities,
    categoryOpportunities,
    healthDistribution,
    recentBriefings,
    modelVersion: BUSINESS_MODEL_VERSION,
  };
}

export type AdminBusinessDashboard = AdminBusinessInsights & {
  experiment: {
    key: string;
    active: boolean;
    algorithmA: string;
    algorithmB: string;
    trafficBPct: number;
  } | null;
};

export async function getAdminBusinessDashboard(): Promise<AdminBusinessDashboard> {
  const insights = await getAdminBusinessInsights();
  let experiment: AdminBusinessDashboard["experiment"] = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("business_assistant_experiments")
      .select("*")
      .eq("experiment_key", "business_assistant_default")
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
  return { ...insights, experiment };
}
