/**
 * Sprint 35 — AI Vision Engine types.
 * Structured vision output only — never free-form text into the app layer.
 */

import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";

/** Service categories Vision V1 can identify. */
export type VisionServiceCategory =
  | "electrician"
  | "plumber"
  | "mechanic"
  | "appliance_repair"
  | "locksmith"
  | "unsupported";

export type VisionConfidenceLevel = "high" | "medium" | "low";

export type VisionUrgency = "emergency" | "high" | "normal" | "low";

/**
 * Canonical structured payload returned by OpenAI Vision.
 * All fields are validated by the parser before use.
 */
export type VisionAnalysisPayload = {
  category: VisionServiceCategory;
  problem: string;
  symptoms: string[];
  visibleObjects: string[];
  possibleCause: string | null;
  urgency: VisionUrgency;
  emergency: boolean;
  confidenceLevel: VisionConfidenceLevel;
  recommendedQuestions: string[];
  summary: string;
};

export type VisionPipelineDecision = {
  /** Natural-language summary fed into HybridProblemDetector (same path as text/voice). */
  queryText: string;
  /** When set, SearchForm can skip the wizard and navigate with this urgency. */
  urgencyOverride: ProblemPriority | null;
  /** True when vision confidence is high enough to skip Diagnosis Wizard questions. */
  skipDiagnosis: boolean;
  /** Hint only — detection still runs through HybridProblemDetector. */
  suggestedProblemId: ProblemId | null;
  analysis: VisionAnalysisPayload;
};

export type VisionAnalyticsEvent =
  | "image_uploaded"
  | "vision_success"
  | "vision_failed"
  | "diagnosis_started"
  | "provider_selected";
