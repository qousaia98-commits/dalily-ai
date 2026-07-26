/**
 * AI Engine Phase 5 — Vision Intelligence.
 */

export type {
  IntentVisionAnalysis,
  DetectedVisionObject,
  DetectedDamage,
  VisionTextFusionResult,
  VisionPrepExtras,
  VisionRiskLevel,
  DamageSeverity,
  VisionObjectImportance,
} from "./types";

export { runVisionIntelligencePipeline } from "./pipeline";
export { fuseTextAndVision } from "./fusion";
export { analyzeIntentVisionImage, parseIntentVisionAnalysis } from "./analyze";
export {
  getVisionAnalysisByHash,
  upsertVisionAnalysis,
  attachVisionAnalysisToRequest,
  confirmVisionAnalysis,
  getLatestVisionForRequest,
} from "./cache";
export { compareVisionAnalysisOutcome } from "./learning";
export {
  filterHighConfidenceObjects,
  VISION_OBJECT_CATALOG,
  VISION_OBJECT_MIN_CONFIDENCE,
} from "./objects";
export {
  filterHighConfidenceDamages,
  VISION_DAMAGE_TYPES,
  VISION_DAMAGE_MIN_CONFIDENCE,
} from "./damage";
export {
  suggestToolsFromVision,
  suggestMaterialsFromVision,
} from "./suggestions";

export const visionModule = {
  id: "vision",
  status: "phase5" as const,
  impl: [
    "src/lib/ai/vision/pipeline.ts",
    "src/lib/ai/vision/fusion.ts",
    "src/lib/vision (search facade)",
  ],
  future: ["bounding-box UI overlays", "multi-image consensus"],
};
