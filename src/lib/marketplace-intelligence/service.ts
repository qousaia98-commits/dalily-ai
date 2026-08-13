/**
 * Marketplace Intelligence Platform service — cache, assemble, persist.
 * Advisory only; simulations never touch production.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { collectMarketplaceRaw } from "@/lib/marketplace-intelligence/collect";
import {
  generateCategoryIntelligence,
  generateRegionalIntelligence,
} from "@/lib/marketplace-intelligence/category-regional";
import {
  generateCustomerMarketInsights,
  generateExecutiveReport,
  generateOpportunities,
  generateProviderMarketInsights,
  generateStrategicRecommendations,
} from "@/lib/marketplace-intelligence/engines";
import { listModules, isModuleEnabled } from "@/lib/marketplace-intelligence/modules";
import { trackMarketplaceIntelEvent } from "@/lib/marketplace-intelligence/observability";
import {
  buildKnowledgeGraphSample,
  defaultSimulations,
  FUTURE_AI_AGENTS,
  runMarketplaceSimulation,
} from "@/lib/marketplace-intelligence/simulation";
import { isAiMarketplaceIntelligenceEnabled } from "@/lib/config/feature-flags";
import {
  MARKET_ADVISORY_NOTICE,
  MARKET_INTEL_VERSION,
  type MarketplaceIntelligencePlatform,
  type SimulationScenario,
} from "@/lib/marketplace-intelligence/types";
import type { Json } from "@/types/database.types";

const PLATFORM_CACHE = new Map<
  string,
  { at: number; data: MarketplaceIntelligencePlatform }
>();
const CACHE_TTL_MS = 90_000;

export async function getMarketplaceIntelligencePlatform(input?: {
  persist?: boolean;
  skipCache?: boolean;
}): Promise<MarketplaceIntelligencePlatform | null> {
  if (!isAiMarketplaceIntelligenceEnabled()) return null;

  const cacheKey = "global";
  if (!input?.skipCache) {
    const hit = PLATFORM_CACHE.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      void trackMarketplaceIntelEvent("cache_performance", { hit: true });
      return { ...hit.data, latencyMs: 1 };
    }
  }

  const started = Date.now();
  const raw = await collectMarketplaceRaw();

  const categories = isModuleEnabled("category_intel")
    ? generateCategoryIntelligence(raw)
    : [];
  const regions = isModuleEnabled("regional_intel")
    ? generateRegionalIntelligence(raw)
    : [];
  const opportunities = isModuleEnabled("opportunity_engine")
    ? generateOpportunities(categories, regions, raw)
    : [];
  const decisions = isModuleEnabled("decision_support")
    ? generateStrategicRecommendations(raw, categories, regions)
    : [];
  const executiveReport = isModuleEnabled("executive_reports")
    ? generateExecutiveReport(raw, opportunities)
    : generateExecutiveReport(raw, []);
  const simulations = isModuleEnabled("digital_twin")
    ? defaultSimulations(raw)
    : [];
  const knowledgeGraphSample = isModuleEnabled("knowledge_graph")
    ? buildKnowledgeGraphSample(raw)
    : [];
  const providerInsights = isModuleEnabled("provider_insights")
    ? generateProviderMarketInsights(categories, regions)
    : [];
  const customerInsights = isModuleEnabled("customer_insights")
    ? generateCustomerMarketInsights(raw)
    : [];

  const {
    categoryKeys: _c,
    regionKeys: _r,
    openQualityCases: _q,
    openFraudCases: _f,
    providerCount: _p,
    bookingSample: _b,
    ...global
  } = raw;

  const data: MarketplaceIntelligencePlatform = {
    modules: listModules().map((m) => ({
      key: m.key,
      kind: m.kind,
      enabled: m.enabled,
      version: m.version,
    })),
    global,
    categories,
    regions,
    opportunities,
    decisions,
    executiveReport,
    simulations,
    knowledgeGraphSample,
    providerInsights,
    customerInsights,
    agents: FUTURE_AI_AGENTS,
    algorithmVersion: MARKET_INTEL_VERSION,
    latencyMs: Date.now() - started,
    advisoryNotice: MARKET_ADVISORY_NOTICE,
  };

  PLATFORM_CACHE.set(cacheKey, { at: Date.now(), data });

  void trackMarketplaceIntelEvent("insight_generated", {
    categories: categories.length,
    regions: regions.length,
    opportunities: opportunities.length,
  });
  void trackMarketplaceIntelEvent("report_generated", {
    reportType: executiveReport.reportType,
  });
  void trackMarketplaceIntelEvent("algorithm_version", {
    version: MARKET_INTEL_VERSION,
  });
  void trackMarketplaceIntelEvent("prediction_accuracy", {
    forecastAccuracy: raw.forecastAccuracy,
  });
  void trackMarketplaceIntelEvent("system_latency", { latencyMs: data.latencyMs });
  void trackMarketplaceIntelEvent("cache_performance", { hit: false });

  if (input?.persist !== false) {
    void persistPlatformSnapshot(data);
  }

  return data;
}

async function persistPlatformSnapshot(
  data: MarketplaceIntelligencePlatform,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("marketplace_intelligence").upsert(
      {
        snapshot_key: "global",
        metrics: data.global as unknown as Json,
        growth_index: data.global.marketplaceGrowth,
        liquidity_index: data.global.marketplaceLiquidity,
        health_score: data.global.healthScore,
        demand_index: data.global.demand,
        supply_index: data.global.supply,
        algorithm_version: data.algorithmVersion,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "snapshot_key" },
    );

    for (const c of data.categories.slice(0, 20)) {
      await admin.from("marketplace_category_metrics").upsert(
        {
          category_key: c.categoryKey,
          growth: c.growth,
          demand: c.demand,
          provider_density: c.providerDensity,
          competition: c.competition,
          average_pricing: c.averagePricing,
          completion_rate: c.completionRate,
          quality: c.quality,
          trust: c.trust,
          profitability: c.profitability,
          seasonality: c.seasonality as unknown as Json,
          peak_hours: c.peakHours as unknown as Json,
          forecast: c.forecast as unknown as Json,
          opportunity_score: c.opportunityScore,
          risk_score: c.riskScore,
          summary_en: c.summaryEn,
          summary_ar: c.summaryAr ?? null,
          algorithm_version: data.algorithmVersion,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "category_key" },
      );
    }

    for (const r of data.regions.slice(0, 20)) {
      await admin.from("marketplace_region_metrics").upsert(
        {
          region_key: r.regionKey,
          demand: r.demand,
          supply: r.supply,
          competition: r.competition,
          growth: r.growth,
          provider_density: r.providerDensity,
          avg_response_min: r.avgResponseMin,
          avg_travel_km: r.avgTravelKm,
          average_pricing: r.averagePricing,
          customer_satisfaction: r.customerSatisfaction,
          complaint_rate: r.complaintRate,
          forecast: r.forecast as unknown as Json,
          opportunity_score: r.opportunityScore,
          expansion_potential: r.expansionPotential,
          heatmap: r.heatmap as unknown as Json,
          summary_en: r.summaryEn,
          summary_ar: r.summaryAr ?? null,
          algorithm_version: data.algorithmVersion,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "region_key" },
      );
      await admin.from("marketplace_heatmaps").upsert(
        {
          region_key: r.regionKey,
          metric_key: "demand",
          cells: r.heatmap.cells as unknown as Json,
          algorithm_version: data.algorithmVersion,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "region_key,metric_key" },
      );
    }

    const { data: reportRow } = await admin
      .from("marketplace_reports")
      .insert({
        report_type: data.executiveReport.reportType,
        summary_en: data.executiveReport.summaryEn,
        summary_ar: data.executiveReport.summaryAr ?? null,
        key_changes: data.executiveReport.keyChanges as unknown as Json,
        risks: data.executiveReport.risks as unknown as Json,
        opportunities: data.executiveReport.opportunities as unknown as Json,
        predictions: data.executiveReport.predictions as unknown as Json,
        recommended_actions: data.executiveReport.recommendedActions as unknown as Json,
        confidence: data.executiveReport.confidence,
        trend_direction: data.executiveReport.trendDirection,
        algorithm_version: data.executiveReport.algorithmVersion,
      })
      .select("id")
      .maybeSingle();

    if (reportRow?.id) {
      await admin.from("marketplace_executive_reports").insert({
        report_id: reportRow.id,
        title: `Executive ${data.executiveReport.reportType} report`,
        executive_summary_en: data.executiveReport.summaryEn,
        executive_summary_ar: data.executiveReport.summaryAr ?? null,
        sections: {
          keyChanges: data.executiveReport.keyChanges,
          risks: data.executiveReport.risks,
          opportunities: data.executiveReport.opportunities,
        } as unknown as Json,
        restricted: true,
        algorithm_version: data.algorithmVersion,
      });
    }

    for (const node of data.knowledgeGraphSample) {
      await admin.from("marketplace_knowledge_graph").upsert(
        {
          node_type: node.nodeType,
          node_key: node.nodeKey,
          label: node.label,
          properties: node.properties as unknown as Json,
          edges: node.edges as unknown as Json,
          internal_only: true,
          algorithm_version: MARKET_INTEL_VERSION,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "node_type,node_key" },
      );
    }
  } catch {
    /* soft persist */
  }
}

export async function executeMarketplaceSimulation(input: {
  title: string;
  scenarioType: string;
  inputs: Record<string, unknown>;
  createdBy?: string;
}): Promise<SimulationScenario | null> {
  if (!isAiMarketplaceIntelligenceEnabled()) return null;
  if (!isModuleEnabled("digital_twin")) return null;

  const raw = await collectMarketplaceRaw();
  const result = runMarketplaceSimulation({
    title: input.title,
    scenarioType: input.scenarioType,
    inputs: input.inputs,
    raw,
  });

  void trackMarketplaceIntelEvent("simulation_executed", {
    scenarioType: input.scenarioType,
    affectsProduction: false,
  });

  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("marketplace_simulations")
      .insert({
        title: result.title,
        scenario_type: result.scenarioType,
        inputs: result.inputs as unknown as Json,
        results: result.results as unknown as Json,
        impact_summary_en: result.impactSummaryEn,
        impact_summary_ar: result.impactSummaryAr ?? null,
        affects_production: false,
        status: "completed",
        algorithm_version: "market-sim-v1",
        created_by: input.createdBy ?? null,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (row?.id) result.id = row.id;
  } catch {
    /* soft */
  }

  PLATFORM_CACHE.clear();
  return result;
}

export async function decideMarketplaceRecommendation(input: {
  recommendationId: string;
  accept: boolean;
  decidedBy: string;
}): Promise<boolean> {
  if (!isAiMarketplaceIntelligenceEnabled()) return false;
  try {
    const admin = createAdminClient();
    const status = input.accept ? "accepted" : "dismissed";
    const { error } = await admin
      .from("marketplace_recommendations")
      .update({
        status,
        decided_at: new Date().toISOString(),
        decided_by: input.decidedBy,
        audit_log: [
          {
            at: new Date().toISOString(),
            by: input.decidedBy,
            action: status,
          },
        ] as unknown as Json,
      })
      .eq("id", input.recommendationId);
    if (error) return false;
    void trackMarketplaceIntelEvent(
      input.accept ? "recommendation_accepted" : "recommendation_dismissed",
      { recommendationId: input.recommendationId },
    );
    return true;
  } catch {
    return false;
  }
}

export async function persistStrategicDecisions(
  decisions: MarketplaceIntelligencePlatform["decisions"],
): Promise<void> {
  try {
    const admin = createAdminClient();
    for (const d of decisions.slice(0, 10)) {
      await admin.from("marketplace_recommendations").insert({
        audience: "executive",
        code: d.code,
        title_en: d.titleEn,
        title_ar: d.titleAr ?? null,
        reason_en: d.reasonEn,
        reason_ar: d.reasonAr ?? null,
        expected_impact: d.expectedImpact,
        confidence: d.confidence,
        required_effort: d.requiredEffort,
        estimated_roi: d.estimatedRoi,
        estimated_time: d.estimatedTime,
        dependencies: d.dependencies as unknown as Json,
        status: "pending",
        algorithm_version: MARKET_INTEL_VERSION,
      });
      await admin.from("marketplace_decisions").insert({
        title_en: d.titleEn,
        title_ar: d.titleAr ?? null,
        reason_en: d.reasonEn,
        expected_impact: d.expectedImpact,
        confidence: d.confidence,
        required_effort: d.requiredEffort,
        estimated_roi: d.estimatedRoi,
        estimated_time: d.estimatedTime,
        dependencies: d.dependencies as unknown as Json,
        status: "proposed",
      });
    }
  } catch {
    /* soft */
  }
}
