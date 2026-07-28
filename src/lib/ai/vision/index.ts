/**
 * AI Vision Bridge (thin) — INTERNAL.
 *
 * Responsibilities: façade metadata, feature-flag routing (via callers),
 * telemetry hooks, future ML/provider routing.
 * Image prompts/parsing live in engines (`lib/vision`, analyze modules).
 * External consumers MUST use `@/domains/vision`.
 *
 * @see docs/architecture/vision.md
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
export { optimizeVisionImage, contentHashFromBytes } from "./optimize";

export const visionModule = {
  id: "vision",
  status: "phase5" as const,
  impl: [
    "src/domains/vision (public API)",
    "src/lib/vision (search vision engine)",
    "src/lib/ai/vision (intent vision bridge)",
    "src/lib/ai/providers (shared OpenAI client)",
  ],
  responsibilities: ["facade", "featureFlags", "providerRouting", "telemetry"] as const,
  future: ["bounding-box UI overlays", "multi-image consensus", "multi-provider vision"],
};
