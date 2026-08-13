/**
 * Admin predictive intelligence dashboard aggregate.
 */

import { forecastDemand } from "./demand";
import { detectMarketplaceBalances } from "./balancer";
import { buildMarketInsights } from "./insights";
import { calibrateDemandForecasts } from "./optimize";
import type { AdminPredictiveDashboard } from "./types";

export async function buildAdminPredictiveDashboard(): Promise<AdminPredictiveDashboard> {
  const [demand, balances, insights] = await Promise.all([
    forecastDemand({ horizonDays: 7 }),
    detectMarketplaceBalances(),
    buildMarketInsights(),
  ]);

  // Opportunistic calibration (yesterday vs forecasts)
  void calibrateDemandForecasts();

  const shortages = balances.filter((b) =>
    b.severity.includes("shortage"),
  ).length;
  const healthScore = Math.max(
    0,
    Math.min(100, 100 - shortages * 12 - (balances.some((b) => b.severity === "critical_shortage") ? 20 : 0)),
  );

  const heatmap = insights.regionalDemand.map((r) => ({
    cityId: r.cityId,
    label: r.cityLabel,
    intensity: Math.min(1, r.count / Math.max(1, insights.regionalDemand[0]?.count ?? 1)),
  }));

  // Average response from wait-time table if any
  let averageResponseMinutes: number | null = null;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_wait_time_estimates")
      .select("response_min_minutes, response_max_minutes")
      .limit(50);
    if (data?.length) {
      const mids = data.map(
        (r) =>
          (Number(r.response_min_minutes) + Number(r.response_max_minutes)) / 2,
      );
      averageResponseMinutes = Math.round(
        mids.reduce((a, b) => a + b, 0) / mids.length,
      );
    }
  } catch {
    averageResponseMinutes = null;
  }

  return {
    demand,
    balances,
    insights,
    healthScore,
    averageResponseMinutes,
    completionTrendPct: insights.providerUtilizationPct,
    predictionAccuracyPct: insights.predictionAccuracyPct,
    heatmap,
  };
}
