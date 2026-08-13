/** AI Engine Phase 2 — structured decision & intelligence primitives. */

export type AiUrgencyLevel = "critical" | "high" | "medium" | "low";

export type AiComplexity = "simple" | "moderate" | "complex";

export type AiServiceType =
  | "repair"
  | "install"
  | "inspection"
  | "emergency_response"
  | "renovation"
  | "maintenance"
  | "other";

export type AiWorkflowStrategy =
  | "direct_contact"
  | "collect_offers"
  | "emergency_dispatch"
  | "guided_diagnosis";

export type CompletenessSignal =
  | "description"
  | "category"
  | "scope"
  | "photo"
  | "location"
  | "measurements"
  | "urgency"
  | "ongoing_status";

export type SmartQuestion = {
  id: string;
  /** i18n key under intentFlow.smartQuestions.* */
  promptKey: string;
  /** What answering this improves. */
  fills: CompletenessSignal;
  priority: number;
  /** True when text/context already answers this. */
  alreadyAnswered: boolean;
};

export type CompletenessBreakdown = {
  score: number;
  signals: Partial<Record<CompletenessSignal, boolean>>;
  missing: CompletenessSignal[];
};

export type AiWorkflowRecommendation = {
  strategy: AiWorkflowStrategy;
  reasonKey: string;
  /** Marketplace urgency mapping. */
  marketplaceUrgency: "emergency" | "normal";
};

export type AiMatchExplanationItem = {
  code: string;
  /** Optional ICU params for i18n. */
  params?: Record<string, string | number>;
  /** Fallback English label for logs/admin. */
  labelEn: string;
};

export type ProviderMatchScoreResult = {
  providerId: string;
  score: number;
  breakdown: Record<string, number>;
  explanations: AiMatchExplanationItem[];
};

/**
 * One structured AI decision for a request (Phase 2).
 */
export type AiDecision = {
  version: 2;
  categorySlug: string;
  subcategory: string | null;
  serviceType: AiServiceType;
  urgency: AiUrgencyLevel;
  urgencyScore: number;
  complexity: AiComplexity;
  confidence: number;
  completeness: CompletenessBreakdown;
  questions: SmartQuestion[];
  workflow: AiWorkflowRecommendation;
  problemId: string | null;
  source: import("@/lib/ai/types").AiResolveSource | "cache";
  skippedLlm: boolean;
  language: string;
  /** Marketplace bridge. */
  marketplaceUrgency: "emergency" | "normal";
};
