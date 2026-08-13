export {
  MARKET_INTEL_VERSION,
  MARKET_SIM_VERSION,
  MARKET_KG_VERSION,
  MARKET_ML_VERSION,
  MARKET_ADVISORY_NOTICE,
} from "@/lib/marketplace-intelligence/types";
export type {
  MarketplaceIntelligencePlatform,
  GlobalMarketplaceMetrics,
  CategoryIntelligence,
  RegionalIntelligence,
  MarketOpportunity,
  StrategicRecommendation,
  ExecutiveReport,
  SimulationScenario,
  ProviderMarketInsight,
  CustomerMarketInsight,
  FutureAgentBlueprint,
  IntelligenceModuleKey,
  EngineKind,
} from "@/lib/marketplace-intelligence/types";

export { listModules, isModuleEnabled, setModuleEnabled } from "@/lib/marketplace-intelligence/modules";
export {
  getMarketplaceIntelligencePlatform,
  executeMarketplaceSimulation,
  decideMarketplaceRecommendation,
} from "@/lib/marketplace-intelligence/service";
export { getAdminMarketplaceCenter } from "@/lib/marketplace-intelligence/admin";
export type { AdminMarketplaceCenter } from "@/lib/marketplace-intelligence/admin";
