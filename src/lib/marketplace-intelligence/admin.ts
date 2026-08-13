/**
 * Admin Marketplace Intelligence Center — executive aggregates only.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketplaceIntelligencePlatform } from "@/lib/marketplace-intelligence/service";
import { listModules } from "@/lib/marketplace-intelligence/modules";
import { MARKET_INTEL_VERSION } from "@/lib/marketplace-intelligence/types";
import type { MarketplaceIntelligencePlatform } from "@/lib/marketplace-intelligence/types";

export type AdminMarketplaceCenter = {
  platform: MarketplaceIntelligencePlatform;
  modules: ReturnType<typeof listModules>;
  persistedReports: number;
  persistedSimulations: number;
  openOpportunities: number;
  algorithmVersion: string;
};

export async function getAdminMarketplaceCenter(): Promise<AdminMarketplaceCenter> {
  const platform =
    (await getMarketplaceIntelligencePlatform({ persist: true })) ??
    ({
      modules: [],
      global: {
        marketplaceGrowth: 0,
        bookings: 0,
        revenue: 0,
        demand: 0,
        supply: 0,
        providerActivity: 0,
        customerActivity: 0,
        completionRate: 0,
        acceptanceRate: 0,
        cancellationRate: 0,
        responseTimesMin: 0,
        reviewTrends: 0,
        trustDistribution: 0,
        fraudTrends: 0,
        qualityTrends: 0,
        pricingTrends: 0,
        forecastAccuracy: 0,
        schedulingEfficiency: 0,
        businessHealth: 0,
        customerSatisfaction: 0,
        marketplaceLiquidity: 0,
        healthScore: 0,
      },
      categories: [],
      regions: [],
      opportunities: [],
      decisions: [],
      executiveReport: {
        reportType: "daily",
        summaryEn: "Feature disabled or empty.",
        keyChanges: [],
        risks: [],
        opportunities: [],
        predictions: [],
        recommendedActions: [],
        confidence: 0,
        trendDirection: "stable",
        algorithmVersion: MARKET_INTEL_VERSION,
      },
      simulations: [],
      knowledgeGraphSample: [],
      providerInsights: [],
      customerInsights: [],
      agents: [],
      algorithmVersion: MARKET_INTEL_VERSION,
      latencyMs: 0,
      advisoryNotice: "",
    } satisfies MarketplaceIntelligencePlatform);

  let persistedReports = 0;
  let persistedSimulations = 0;
  let openOpportunities = 0;

  try {
    const admin = createAdminClient();
    const { count: rc } = await admin
      .from("marketplace_reports")
      .select("id", { count: "exact", head: true });
    persistedReports = rc ?? 0;
    const { count: sc } = await admin
      .from("marketplace_simulations")
      .select("id", { count: "exact", head: true });
    persistedSimulations = sc ?? 0;
    const { count: oc } = await admin
      .from("marketplace_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    openOpportunities = oc ?? platform.opportunities.length;
  } catch {
    openOpportunities = platform.opportunities.length;
  }

  return {
    platform,
    modules: listModules(),
    persistedReports,
    persistedSimulations,
    openOpportunities,
    algorithmVersion: MARKET_INTEL_VERSION,
  };
}
