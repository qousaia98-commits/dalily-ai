/**
 * Image analysis pipeline:
 * validate → optimize → (cache hit?) → Vision AI → structured extract → fuse with text → store
 */

import { analyzeIntentVisionImage } from "./analyze";
import {
  getVisionAnalysisByHash,
  upsertVisionAnalysis,
} from "./cache";
import { fuseTextAndVision } from "./fusion";
import { contentHashFromBytes, optimizeVisionImage } from "./optimize";
import type { VisionTextFusionResult } from "./types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isAiEngineV5Enabled } from "@/lib/config/feature-flags";

export type VisionPipelineResult =
  | {
      success: true;
      analysisId: string | null;
      fusion: VisionTextFusionResult;
      fromCache: boolean;
    }
  | {
      success: false;
      error:
        | "feature_disabled"
        | "empty"
        | "too_large"
        | "invalid_type"
        | "analysis_failed"
        | "no_api_key";
    };

export async function runVisionIntelligencePipeline(input: {
  bytes: ArrayBuffer;
  mimeType: string;
  intentText?: string;
  textCategorySlug?: string | null;
  serviceRequestId?: string | null;
}): Promise<VisionPipelineResult> {
  if (!isAiEngineV5Enabled()) {
    return { success: false, error: "feature_disabled" };
  }

  const optimized = optimizeVisionImage({
    bytes: input.bytes,
    mimeType: input.mimeType,
  });
  if (!optimized.ok) {
    return { success: false, error: optimized.error };
  }

  const contentHash = contentHashFromBytes(optimized.bytes);

  const cached = await getVisionAnalysisByHash(contentHash);
  if (cached?.fusion) {
    void emitAiLearningEvent({
      eventType: "vision_cached",
      serviceRequestId: input.serviceRequestId,
      metadata: { analysisId: cached.id, contentHash },
    });
    return {
      success: true,
      analysisId: cached.id,
      fusion: cached.fusion,
      fromCache: true,
    };
  }

  const vision = await analyzeIntentVisionImage({
    bytes: optimized.bytes,
    mimeType: optimized.mimeType,
    intentText: input.intentText,
  });

  if (!vision.success) {
    return {
      success: false,
      error: vision.error === "no_api_key" ? "no_api_key" : "analysis_failed",
    };
  }

  const fusion = fuseTextAndVision({
    intentText: input.intentText ?? "",
    analysis: vision.analysis,
    textCategorySlug: input.textCategorySlug,
  });

  if (fusion.contradiction) {
    void emitAiLearningEvent({
      eventType: "vision_contradiction",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        textCategorySlug: input.textCategorySlug,
        visionCategory: vision.analysis.categoryHint,
      },
    });
  } else {
    void emitAiLearningEvent({
      eventType: "vision_fused",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        fusedConfidence: fusion.fusedConfidence,
        jobCategorySlug: fusion.jobCategorySlug,
      },
    });
  }

  const analysisId = await upsertVisionAnalysis({
    contentHash,
    analysis: vision.analysis,
    fusion,
    mimeType: optimized.mimeType,
    byteSize: optimized.byteSize,
    serviceRequestId: input.serviceRequestId,
  });

  return {
    success: true,
    analysisId,
    fusion,
    fromCache: false,
  };
}
