/**
 * Environment alias catalog (Sprint 9.5 Phase 6).
 *
 * Canonical key → deprecated aliases (still accepted at runtime).
 * Documentation is generated from this table.
 */

export type EnvAliasEntry = {
  canonical: string;
  aliases: readonly string[];
  /** Domain bucket for docs */
  category:
    | "ai"
    | "marketplace"
    | "payments"
    | "providers"
    | "runtime"
    | "telemetry";
  deprecated?: boolean;
  notes?: string;
};

export const ENV_ALIASES: readonly EnvAliasEntry[] = [
  {
    canonical: "OCR_PROVIDER",
    aliases: ["VISION_PROVIDER"],
    category: "providers",
    notes: "Vision / OCR provider id; unimplemented IDs map to openai",
  },
  {
    canonical: "WHISPER_PROVIDER",
    aliases: ["SPEECH_PROVIDER", "STT_PROVIDER"],
    category: "providers",
  },
  {
    canonical: "FORECAST_PROVIDER",
    aliases: ["PREDICTION_PROVIDER"],
    category: "providers",
  },
  {
    canonical: "CHAT_PROVIDER",
    aliases: ["MESSAGING_PROVIDER"],
    category: "providers",
  },
  {
    canonical: "CHAT_ENGINE",
    aliases: ["CHAT_AUTH_V2"],
    category: "marketplace",
    deprecated: false,
    notes: "CHAT_AUTH_V2 remains accepted",
  },
  {
    canonical: "MESSAGING_ENGINE",
    aliases: [],
    category: "marketplace",
    notes: "Cascades to CHAT_ENGINE when unset",
  },
  {
    canonical: "REALTIME_ENGINE",
    aliases: ["REALTIME_CHAT", "REALTIME_CHAT_V1"],
    category: "marketplace",
  },
  {
    canonical: "VISION_ENGINE",
    aliases: ["AI_ENGINE_V5"],
    category: "ai",
    notes: "Also cascades via AI_ENGINE_V5+ ladder",
  },
  {
    canonical: "SPEECH_ENGINE",
    aliases: ["AI_ENGINE_V6"],
    category: "ai",
  },
  {
    canonical: "FORECAST_ENGINE",
    aliases: [
      "AI_DEMAND_FORECASTING",
      "AI_DEMAND_FORECASTING_V1",
      "DEMAND_FORECASTING",
    ],
    category: "ai",
  },
  {
    canonical: "PREDICTIVE_ENGINE",
    aliases: ["AI_ENGINE_V8"],
    category: "ai",
  },
  {
    canonical: "SMART_MATCHING_ENGINE",
    aliases: ["SMART_MATCHING_ENGINE_V1", "AI_SMART_MATCHING"],
    category: "ai",
    deprecated: true,
    notes: "Aliases deprecated but still OR'd at runtime",
  },
  {
    canonical: "PROVIDER_MONETIZATION",
    aliases: ["PROVIDER_MONETIZATION_V1", "LEAD_MONETIZATION_V1"],
    category: "payments",
  },
  {
    canonical: "PAYMENT_INFRASTRUCTURE",
    aliases: ["PAYMENT_INFRASTRUCTURE_V1"],
    category: "payments",
  },
  {
    canonical: "FINANCIAL_DOCUMENTS",
    aliases: ["FINANCIAL_DOCUMENTS_V1"],
    category: "payments",
  },
  {
    canonical: "REFUNDS_DISPUTES",
    aliases: ["REFUNDS_DISPUTES_V1"],
    category: "payments",
  },
  {
    canonical: "FINANCE_DASHBOARD",
    aliases: ["FINANCE_DASHBOARD_V1"],
    category: "payments",
  },
  {
    canonical: "REVIEWS_REPUTATION_V2",
    aliases: ["REVIEWS_REPUTATION", "AI_REPUTATION_V1"],
    category: "ai",
  },
  {
    canonical: "AI_REPUTATION_ENGINE",
    aliases: ["AI_REPUTATION_ENGINE_V1"],
    category: "ai",
  },
  {
    canonical: "QUALITY_CASES",
    aliases: ["QUALITY_CASES_V1", "QA_CASE_MANAGEMENT"],
    category: "ai",
  },
  {
    canonical: "FRAUD_DETECTION",
    aliases: ["FRAUD_DETECTION_V1", "RISK_INTELLIGENCE"],
    category: "ai",
  },
  {
    canonical: "AI_OPS",
    aliases: ["AI_OPS_V1", "PLATFORM_HEALTH", "AI_OPERATIONS"],
    category: "ai",
  },
  {
    canonical: "AI_DYNAMIC_PRICING",
    aliases: ["AI_DYNAMIC_PRICING_V1", "DYNAMIC_PRICING"],
    category: "ai",
  },
  {
    canonical: "AI_SCHEDULING",
    aliases: ["AI_SCHEDULING_V1", "AI_CAPACITY_OPTIMIZATION"],
    category: "ai",
  },
  {
    canonical: "AI_BUSINESS_ASSISTANT",
    aliases: ["AI_BUSINESS_ASSISTANT_V1", "BUSINESS_ASSISTANT"],
    category: "ai",
  },
  {
    canonical: "AI_MARKETPLACE_INTELLIGENCE",
    aliases: ["AI_MARKETPLACE_INTELLIGENCE_V1", "MARKETPLACE_INTELLIGENCE"],
    category: "ai",
  },
  {
    canonical: "OPENAI_API_KEY",
    aliases: ["SEARCH_LLM_API_KEY", "CHAT_AI_API_KEY"],
    category: "providers",
    notes: "Shared OpenAI key aliases used by search/chat helpers",
  },
] as const;
