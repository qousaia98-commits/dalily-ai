/**
 * Dalily AI Engine — Phase 1–9.
 */

export const AI_ENGINE = {
  version: 9,
  phase: "autonomous_actions",
  modules: [
    "intent",
    "matching",
    "dispatch",
    "jobs",
    "learning",
    "memory",
    "pricing",
    "routing",
    "recommendations",
    "vision",
    "voice",
    "assistant",
    "predictive",
    "automation",
    "fraud",
    "knowledge",
    "privacy",
    "provider",
    "questions",
    "urgency",
    "completeness",
  ],
} as const;

export type { AiLanguage, AiDialect, AiResolveSource } from "./types";
export {
  AI_KNOWLEDGE_HIT_THRESHOLD,
  AI_KNOWLEDGE_STORE_THRESHOLD,
  AI_MAX_TEXT_CHARS,
} from "./types";

export { scrubAiText, detectLanguageHint, normalizeAiPhrase } from "./privacy/scrub";

export type {
  AiIntentMemoryRecord,
  RecordIntentMemoryInput,
} from "./memory/types";
export { recordIntentMemory } from "./memory/record";

export type {
  AiLearningEventType,
  AiLearningEventInput,
} from "./learning/types";
export { emitAiLearningEvent, AI_LEARNING_EVENT_TYPES } from "./learning/events";
export {
  learnFromProviderDecision,
  learnFromUrgencyCorrection,
  learnFromWorkflowOverride,
} from "./learning/match-feedback";

export type {
  KnowledgePhrase,
  KnowledgeLookupHit,
  KnowledgeFeedbackKind,
} from "./knowledge/types";
export { lookupKnowledge } from "./knowledge/lookup";
export { applyKnowledgeFeedback, upsertKnowledgeFromDetection } from "./knowledge/feedback";

export type { IntentResolveResult } from "./intent/types";
export { resolveIntentCategory } from "./intent/resolve";
export { runIntentPipeline } from "./intent/pipeline";
export type { IntentPipelineInput } from "./intent/pipeline";

export type {
  AiDecision,
  AiUrgencyLevel,
  AiComplexity,
  AiServiceType,
  SmartQuestion,
  CompletenessBreakdown,
  AiWorkflowRecommendation,
  ProviderMatchScoreResult,
  AiMatchExplanationItem,
} from "./decision/types";

export { getProviderBehaviourSignals } from "./provider/behaviour";

export {
  matchingModule,
  scoreProviderMatch,
  rankProvidersByMatchScore,
  selectAssignmentsWithAiRanking,
} from "./matching";
export {
  dispatchModule,
  selectAssignmentsWithSmartDispatch,
  compareDispatchPrediction,
  planMarketplaceExposure,
  computeReputation,
  estimateEta,
  predictResponse,
  estimateCapacity,
} from "./dispatch";
export type {
  DispatchRankedAssignment,
  ExposureMode,
  ResponseBand,
  DispatchScoreResult,
} from "./dispatch";
export {
  jobsModule,
  analyzeJob,
  getProviderPrepForRequest,
  analyzeAndStoreJob,
  compareJobAnalysisOutcome,
  SERVICE_KNOWLEDGE_CATALOG,
} from "./jobs";
export type { JobAnalysis, ProviderPrepSummary } from "./jobs";
export { pricingModule } from "./pricing";
export { routingModule } from "./routing";
export { recommendationsModule } from "./recommendations";
export { recommendWorkflow } from "./recommendations/workflow";
export {
  visionModule,
  runVisionIntelligencePipeline,
  fuseTextAndVision,
  compareVisionAnalysisOutcome,
  getLatestVisionForRequest,
} from "./vision";
export type {
  IntentVisionAnalysis,
  VisionTextFusionResult,
  DetectedVisionObject,
  DetectedDamage,
} from "./vision";
export {
  voiceModule,
  runVoiceIntelligencePipeline,
  fuseVoiceTextImage,
  compareVoiceTranscriptOutcome,
  getVoiceProviderPreview,
  buildSmartTranscript,
  detectVoiceLanguage,
} from "./voice";
export type {
  VoicePipelineResult,
  VoiceProviderPreview,
  MultimodalFusionResult,
  SmartTranscript,
} from "./voice";
export {
  assistantModule,
  buildCustomerAssistant,
  buildProviderAssistant,
  compareOffers,
  summarizeConversation,
  buildAppointmentBriefing,
  buildAfterJobAssist,
} from "./assistant";
export type {
  CustomerAssistantView,
  ProviderAssistantView,
  OfferComparisonResult,
  ConversationSummary,
} from "./assistant";
export {
  predictiveModule,
  forecastDemand,
  forecastProviderAvailability,
  estimateWaitTime,
  detectMarketplaceBalances,
  buildAdminPredictiveDashboard,
  buildMarketInsights,
  calibrateDemandForecasts,
} from "./predictive";
export type {
  DemandForecastResult,
  WaitTimeEstimate,
  MarketplaceBalance,
  AdminPredictiveDashboard,
} from "./predictive";
export {
  automationModule,
  runWorkflow,
  runCustomerAutomations,
  runProviderAutomations,
  runAdminAutomations,
  buildAdminAutomationDashboard,
  recordAutomationFeedback,
  reverseAutomationAction,
  getProviderAutomationSettings,
  upsertProviderAutomationSettings,
  WORKFLOW_CATALOG,
  FORBIDDEN_AUTO_ACTIONS,
} from "./automation";
export type {
  AutomationSuggestion,
  AdminAutomationDashboard,
  ProviderAutomationSettings,
  WorkflowRunResult,
} from "./automation";
export { fraudModule } from "./fraud";

export { detectUrgency, urgencyToMarketplace } from "./urgency/detect";
export { calculateCompleteness } from "./completeness/score";
export { buildSmartQuestions } from "./questions/engine";
