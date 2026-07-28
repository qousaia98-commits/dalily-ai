/**
 * Vision Engine barrel — INTERNAL runtime (search / problem photo path).
 * External consumers: `@/domains/vision`.
 */

export { analyzeVisionImage } from "@/lib/vision/service";
export type {
  AnalyzeVisionImageInput,
  AnalyzeVisionImageResult,
} from "@/lib/vision/service";
export { buildVisionPipelineDecision } from "@/lib/vision/summary";
export { trackVisionAnalytics } from "@/lib/vision/analytics";
export { parseVisionAnalysis } from "@/lib/vision/parser";
export { problemIdForVisionCategory } from "@/lib/vision/category-map";
export {
  VISION_MAX_IMAGE_BYTES,
  VISION_MAX_EDGE,
  VISION_COMPRESS_QUALITY,
  VISION_REQUEST_TIMEOUT_MS,
  VISION_ALLOWED_MIME,
  VISION_SKIP_DIAGNOSIS_CONFIDENCE,
  VISION_SERVICE_CATEGORIES,
} from "@/lib/vision/constants";
export type { VisionAllowedMime } from "@/lib/vision/constants";
export type {
  VisionAnalysisPayload,
  VisionPipelineDecision,
  VisionServiceCategory,
  VisionAnalyticsEvent,
  VisionConfidenceLevel,
  VisionUrgency,
} from "@/lib/vision/types";
