/** Sprint 8 Phase 6 — AI Marketplace Intelligence Platform types */

export const MARKET_INTEL_VERSION = "market-intel-v1";
export const MARKET_SIM_VERSION = "market-sim-v1";
export const MARKET_KG_VERSION = "market-kg-v1";
export const MARKET_ML_VERSION = "market-ml-v0";

export const MARKET_ADVISORY_NOTICE =
  "Advisory only. Simulations never affect production. Agents never perform irreversible actions without authorization.";

export type EngineKind = "rule" | "ml" | "predictive" | "simulation" | "agent";

export type IntelligenceModuleKey =
  | "global_analysis"
  | "category_intel"
  | "regional_intel"
  | "opportunity_engine"
  | "executive_reports"
  | "digital_twin"
  | "decision_support"
  | "knowledge_graph"
  | "provider_insights"
  | "customer_insights"
  | "ml_ensemble"
  | "strategy_agent";

export type TrendDirection = "rising" | "stable" | "declining";

export type ReportType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "ad_hoc";

export type GlobalMarketplaceMetrics = {
  marketplaceGrowth: number;
  bookings: number;
  revenue: number;
  demand: number;
  supply: number;
  providerActivity: number;
  customerActivity: number;
  completionRate: number;
  acceptanceRate: number;
  cancellationRate: number;
  responseTimesMin: number;
  reviewTrends: number;
  trustDistribution: number;
  fraudTrends: number;
  qualityTrends: number;
  pricingTrends: number;
  forecastAccuracy: number;
  schedulingEfficiency: number;
  businessHealth: number;
  customerSatisfaction: number;
  marketplaceLiquidity: number;
  healthScore: number;
};

export type CategoryIntelligence = {
  categoryKey: string;
  growth: number;
  demand: number;
  providerDensity: number;
  competition: number;
  averagePricing: number;
  completionRate: number;
  quality: number;
  trust: number;
  profitability: number;
  seasonality: Record<string, number>;
  peakHours: string[];
  forecast: { nextWeek: number; direction: TrendDirection };
  opportunityScore: number;
  riskScore: number;
  summaryEn: string;
  summaryAr?: string;
};

export type RegionalIntelligence = {
  regionKey: string;
  demand: number;
  supply: number;
  competition: number;
  growth: number;
  providerDensity: number;
  avgResponseMin: number;
  avgTravelKm: number;
  averagePricing: number;
  customerSatisfaction: number;
  complaintRate: number;
  forecast: { nextWeek: number; direction: TrendDirection };
  opportunityScore: number;
  expansionPotential: number;
  heatmap: { cells: Array<{ lat: number; lng: number; intensity: number }> };
  summaryEn: string;
  summaryAr?: string;
};

export type MarketOpportunity = {
  id?: string;
  code: string;
  kind: string;
  titleEn: string;
  titleAr?: string;
  bodyEn?: string;
  bodyAr?: string;
  regionKey?: string;
  categoryKey?: string;
  score: number;
};

export type StrategicRecommendation = {
  id?: string;
  code: string;
  titleEn: string;
  titleAr?: string;
  reasonEn: string;
  reasonAr?: string;
  expectedImpact: string;
  confidence: number;
  requiredEffort: string;
  estimatedRoi: number;
  estimatedTime: string;
  dependencies: string[];
};

export type ExecutiveReport = {
  reportType: ReportType;
  summaryEn: string;
  summaryAr?: string;
  keyChanges: string[];
  risks: string[];
  opportunities: string[];
  predictions: string[];
  recommendedActions: string[];
  confidence: number;
  trendDirection: TrendDirection;
  algorithmVersion: string;
};

export type SimulationScenario = {
  id?: string;
  title: string;
  scenarioType: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  impactSummaryEn: string;
  impactSummaryAr?: string;
  affectsProduction: false;
  status: string;
};

export type KnowledgeGraphNode = {
  nodeType: string;
  nodeKey: string;
  label: string;
  properties: Record<string, unknown>;
  edges: Array<{ toType: string; toKey: string; relation: string }>;
};

export type ProviderMarketInsight = {
  code: string;
  labelEn: string;
  labelAr?: string;
  severity: "info" | "positive" | "warning";
};

export type CustomerMarketInsight = {
  code: string;
  labelEn: string;
  labelAr?: string;
  severity: "info" | "positive" | "warning";
};

export type FutureAgentBlueprint = {
  id: string;
  name: string;
  scope: string;
  mayActIrreversibly: false;
  requiresAuthorization: true;
};

export type MarketplaceIntelligencePlatform = {
  modules: Array<{
    key: IntelligenceModuleKey;
    kind: EngineKind;
    enabled: boolean;
    version: string;
  }>;
  global: GlobalMarketplaceMetrics;
  categories: CategoryIntelligence[];
  regions: RegionalIntelligence[];
  opportunities: MarketOpportunity[];
  decisions: StrategicRecommendation[];
  executiveReport: ExecutiveReport;
  simulations: SimulationScenario[];
  knowledgeGraphSample: KnowledgeGraphNode[];
  providerInsights: ProviderMarketInsight[];
  customerInsights: CustomerMarketInsight[];
  agents: FutureAgentBlueprint[];
  algorithmVersion: string;
  latencyMs: number;
  advisoryNotice: string;
};
