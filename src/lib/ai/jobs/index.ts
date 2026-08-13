/**
 * AI Engine Phase 4 — Job Intelligence & Service Knowledge.
 */
export type {
  JobAnalysis,
  ProviderPrepSummary,
  ServiceKnowledgeEntry,
  DurationEstimate,
  PriceEstimate,
  JobComplexity,
} from "./types";

export {
  SERVICE_KNOWLEDGE_CATALOG,
  getServiceKnowledge,
  listServiceKnowledgeByCategory,
} from "./catalog";
export {
  analyzeJob,
  matchServiceKnowledge,
  detectMultiService,
} from "./analyze";
export { buildProviderPrepSummary } from "./preparation";
export {
  persistJobAnalysis,
  getLatestJobAnalysisForRequest,
} from "./repository";
export { compareJobAnalysisOutcome } from "./learning";
export {
  analyzeAndStoreJob,
  getProviderPrepForRequest,
} from "./service";

export const jobsModule = {
  id: "jobs",
  status: "phase4" as const,
  future: ["city price indices", "live duration feedback loops"],
};
