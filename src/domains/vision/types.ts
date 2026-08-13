/**
 * Canonical vision types — Sprint 9.5 Phase 3.
 * Client-safe leaf types only (no server service modules).
 */

export type {
  VisionAnalysisPayload,
  VisionPipelineDecision,
  VisionServiceCategory,
  VisionAnalyticsEvent,
  VisionConfidenceLevel,
  VisionUrgency,
} from "@/lib/vision/types";

export type {
  IntentVisionAnalysis,
  DetectedVisionObject,
  DetectedDamage,
  VisionTextFusionResult,
  VisionPrepExtras,
  VisionRiskLevel,
  DamageSeverity,
  VisionObjectImportance,
} from "@/lib/ai/vision/types";

export type {
  VisionLocalImage,
  PrepareVisionImageError,
  PrepareVisionImageResult,
} from "@/lib/vision/client-upload";
