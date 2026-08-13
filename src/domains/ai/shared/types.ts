/**
 * Sprint 10 Phase 5 — public AI platform types (provider-agnostic).
 */

export type LlmProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "azure_openai"
  | "openrouter"
  | "self_hosted"
  | "local"
  | "mock";

export type AiPlatformFeature =
  | "assistant"
  | "pricing"
  | "matching"
  | "translation"
  | "summary"
  | "fraud"
  | "moderation"
  | "analytics"
  | "forecast"
  | "scheduler"
  | "knowledge"
  | "other";

export type AiPriceEstimateView = {
  low: number;
  expected: number;
  premium: number;
  currency: string;
  confidence: number;
  marketPosition: "budget" | "fair" | "premium";
  explanations: string[];
  advisoryOnly: true;
};

export type AiTranslationView = {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
  confidence: number;
  provider: string;
  originalPreserved: true;
};

export type AiSummaryView = {
  kind: "conversation" | "booking" | "offer" | "review" | "dispute" | "admin";
  summary: string;
  locale: string;
  confidence: number;
  advisoryOnly: true;
};

export type AiFraudAnalysisView = {
  riskLevel: "low" | "medium" | "high" | "critical";
  reasons: string[];
  suggestedAdminAction: "monitor" | "investigate" | "escalate" | "none";
  neverAutoBan: true;
};

export type AiModerationView = {
  riskLevel: "low" | "medium" | "high" | "critical";
  categories: string[];
  reasons: string[];
  suggestedAction: "allow" | "review" | "hide" | "escalate";
  confidence: number;
  neverAutoEnforce: true;
};

export type AiAssistantCapability =
  | "improve_description"
  | "structure_request"
  | "recommend_category"
  | "estimate_budget"
  | "estimate_time"
  | "recommend_providers"
  | "explain_match"
  | "compare_offers"
  | "summarize_reviews"
  | "platform_faq"
  | "dispute_help"
  | "draft_offer"
  | "improve_proposal"
  | "improve_profile"
  | "suggest_pricing"
  | "suggest_times"
  | "trust_tips"
  | "draft_reply"
  | "summarize_chat";

export type AiAssistantResponseView = {
  role: "customer" | "provider";
  capability: AiAssistantCapability;
  title: string;
  body: string;
  bullets: string[];
  confidence: number;
  regeneratable: true;
  neverAutoSubmit: true;
  neverAutoSend: true;
};

export type AiPlatformHealthView = {
  platformEnabled: boolean;
  primaryProvider: LlmProviderId;
  fallbackProvider: LlmProviderId;
  flags: {
    assistant: boolean;
    translation: boolean;
    pricing: boolean;
    analytics: boolean;
    fraud: boolean;
    moderation: boolean;
  };
  usage24h: {
    requests: number;
    errors: number;
    avgLatencyMs: number | null;
    fallbacks: number;
  };
  openFraudAlerts: number;
  openModerationReports: number;
};

export type AiCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiCompletionResult =
  | {
      ok: true;
      content: string;
      providerId: LlmProviderId;
      model: string;
      latencyMs: number;
      promptTokens?: number;
      completionTokens?: number;
      fallbackUsed: boolean;
    }
  | {
      ok: false;
      error: string;
      providerId: LlmProviderId;
      fallbackUsed: boolean;
    };
