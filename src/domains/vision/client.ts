/**
 * Client-safe Vision public surface.
 * Use from `"use client"` modules instead of `@/domains/vision`.
 */

export {
  prepareVisionImage,
  revokeVisionPreview,
  extractImageFilesFromDataTransfer,
  extractImageFileFromClipboard,
  type VisionLocalImage,
  type PrepareVisionImageError,
  type PrepareVisionImageResult,
} from "@/lib/vision/client-upload";

export type {
  VisionAnalysisPayload,
  VisionPipelineDecision,
  VisionServiceCategory,
  VisionConfidenceLevel,
  VisionUrgency,
} from "@/domains/vision/types";

export {
  VISION_ALLOWED_MIME,
  VISION_MAX_IMAGE_BYTES,
  VISION_MAX_EDGE,
  VISION_COMPRESS_QUALITY,
} from "@/lib/vision/constants";
