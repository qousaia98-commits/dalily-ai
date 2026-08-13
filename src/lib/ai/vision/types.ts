/** AI Engine Phase 5 — Vision Intelligence types. */

export type VisionObjectImportance = "primary" | "secondary" | "context";

export type DetectedVisionObject = {
  name: string;
  confidence: number;
  importance: VisionObjectImportance;
  /** Optional normalized box 0–1 — when model provides it. */
  boundingRegion?: { x: number; y: number; w: number; h: number } | null;
  tradeHint?: string | null;
};

export type DamageSeverity = "low" | "medium" | "high" | "critical";

export type DetectedDamage = {
  type: string;
  confidence: number;
  severity: DamageSeverity;
  description?: string | null;
};

export type VisionRiskLevel = "low" | "medium" | "high";

/**
 * Structured Phase-5 vision result (extends Sprint-35 fields).
 */
export type IntentVisionAnalysis = {
  version: 5;
  categoryHint: string;
  problem: string;
  symptoms: string[];
  objects: DetectedVisionObject[];
  damages: DetectedDamage[];
  possibleCause: string | null;
  urgency: "emergency" | "high" | "normal" | "low";
  emergency: boolean;
  confidenceLevel: "high" | "medium" | "low";
  overallConfidence: number;
  estimatedRisk: VisionRiskLevel;
  recommendedQuestions: string[];
  summaryEn: string;
  summaryAr: string;
  rawVisibleObjects: string[];
};

export type VisionTextFusionResult = {
  analysis: IntentVisionAnalysis;
  jobCategorySlug: string | null;
  urgencyBoost: boolean;
  contradiction: boolean;
  needsClarification: boolean;
  clarificationPromptKey: string | null;
  fusedConfidence: number;
  customerSummaryEn: string;
  customerSummaryAr: string;
  suggestedTools: string[];
  suggestedMaterials: string[];
};

export type VisionPrepExtras = {
  detectedObjects: string[];
  likelyDamage: string[];
  estimatedRisk: VisionRiskLevel;
  imageConfidence: number;
  contradiction: boolean;
};
