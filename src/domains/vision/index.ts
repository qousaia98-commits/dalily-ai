/**
 * SAD Vision domain — canonical public entry (Sprint 9.5 Phase 3).
 *
 * UI / Actions / Pages → @/domains/vision → vision engine / AI bridge → providers
 *
 * `"use client"` modules must import from `@/domains/vision/client`.
 *
 * @see docs/architecture/vision.md
 */

export const VISION_DOMAIN = {
  service: "vision",
  owns: ["ai_vision_analyses", "search_vision_ephemeral"],
  impl: [
    "src/domains/vision",
    "src/lib/vision (search vision engine)",
    "src/lib/ai/vision (intent AI bridge)",
    "src/lib/ai/providers (OpenAI vision client)",
  ],
  status: "active",
  sprint: "9.5",
  featureFlag: "VISION_ENGINE",
  legacyAliasFlags: ["AI_ENGINE_V5"],
} as const;

/* —— Search vision engine —— */
export {
  analyzeVisionImage,
  buildVisionPipelineDecision,
  trackVisionAnalytics,
  VISION_MAX_IMAGE_BYTES,
  VISION_ALLOWED_MIME,
  VISION_SKIP_DIAGNOSIS_CONFIDENCE,
  VISION_SERVICE_CATEGORIES,
} from "@/domains/vision/adapters/engine";

/* —— Intent AI bridge —— */
export {
  visionModule,
  runVisionIntelligencePipeline,
  analyzeIntentVisionImage,
  confirmVisionAnalysis,
  attachVisionAnalysisToRequest,
  getLatestVisionForRequest,
  optimizeVisionImage,
  contentHashFromBytes,
  fuseTextAndVision,
  suggestToolsFromVision,
  suggestMaterialsFromVision,
} from "@/domains/vision/adapters/ai-bridge";

/* —— Types —— */
export type {
  VisionAnalysisPayload,
  VisionPipelineDecision,
  VisionServiceCategory,
  VisionAnalyticsEvent,
  VisionConfidenceLevel,
  VisionUrgency,
  IntentVisionAnalysis,
  DetectedVisionObject,
  DetectedDamage,
  VisionTextFusionResult,
  VisionPrepExtras,
  VisionLocalImage,
  PrepareVisionImageResult,
  PrepareVisionImageError,
} from "@/domains/vision/types";

export type {
  AnalyzeVisionImageInput,
  AnalyzeVisionImageResult,
} from "@/lib/vision/service";
