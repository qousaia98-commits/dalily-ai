"use server";

/**
 * Sprint 35 — Vision actions.
 * Images are ephemeral: read from the request FormData, sent to OpenAI Vision,
 * then discarded. Never written to Supabase Storage or disk.
 */

import { analyzeVisionImage } from "@/lib/vision/service";
import { buildVisionPipelineDecision } from "@/lib/vision/summary";
import { trackVisionAnalytics } from "@/lib/vision/analytics";
import {
  VISION_ALLOWED_MIME,
  VISION_MAX_IMAGE_BYTES,
} from "@/lib/vision/constants";
import type { VisionAnalysisPayload, VisionPipelineDecision } from "@/lib/vision/types";
import { detectDiagnosisAction } from "@/actions/diagnosis.actions";
import type { ProblemId } from "@/lib/search/engine/types";

export type AnalyzeVisionProblemResult =
  | {
      success: true;
      analysis: VisionAnalysisPayload;
      decision: VisionPipelineDecision;
      /** When skipDiagnosis is false, whether Diagnosis Wizard should open. */
      diagnosisProblemId: ProblemId | null;
    }
  | {
      success: false;
      error:
        | "no_image"
        | "file_too_large"
        | "invalid_file_type"
        | "unsupported"
        | "analysis_failed";
    };

function isAllowedImageType(mimeType: string): boolean {
  return (VISION_ALLOWED_MIME as readonly string[]).includes(mimeType);
}

/**
 * Analyze an uploaded problem photo and route into the existing AI pipeline.
 * Returns structured data + query text for HybridProblemDetector — never free-form model text.
 */
export async function analyzeVisionProblemAction(
  formData: FormData,
): Promise<AnalyzeVisionProblemResult> {
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    await trackVisionAnalytics("vision_failed", { reason: "no_image" });
    return { success: false, error: "no_image" };
  }

  if (file.size > VISION_MAX_IMAGE_BYTES) {
    await trackVisionAnalytics("vision_failed", { reason: "file_too_large" });
    return { success: false, error: "file_too_large" };
  }

  const mime = file.type || "image/jpeg";
  if (!isAllowedImageType(mime)) {
    await trackVisionAnalytics("vision_failed", { reason: "invalid_file_type" });
    return { success: false, error: "invalid_file_type" };
  }

  await trackVisionAnalytics("image_uploaded", {
    bytes: file.size,
    mime,
  });

  const bytes = await file.arrayBuffer();
  const result = await analyzeVisionImage({ bytes, mimeType: mime });

  if (!result.success) {
    await trackVisionAnalytics("vision_failed", { reason: result.error });
    return { success: false, error: "analysis_failed" };
  }

  const { analysis } = result;

  if (analysis.category === "unsupported") {
    await trackVisionAnalytics("vision_failed", {
      reason: "unsupported",
      confidenceLevel: analysis.confidenceLevel,
    });
    return { success: false, error: "unsupported" };
  }

  const decision = buildVisionPipelineDecision(analysis);
  if (!decision) {
    await trackVisionAnalytics("vision_failed", { reason: "empty_decision" });
    return { success: false, error: "unsupported" };
  }

  await trackVisionAnalytics("vision_success", {
    category: analysis.category,
    confidenceLevel: analysis.confidenceLevel,
    urgency: analysis.urgency,
    emergency: analysis.emergency,
    skipDiagnosis: decision.skipDiagnosis,
  });

  let diagnosisProblemId: ProblemId | null = null;

  if (!decision.skipDiagnosis) {
    const detection = await detectDiagnosisAction(decision.queryText);
    diagnosisProblemId = detection?.problemId ?? null;
    if (diagnosisProblemId) {
      await trackVisionAnalytics("diagnosis_started", {
        problemId: diagnosisProblemId,
        category: analysis.category,
      });
    }
  }

  return {
    success: true,
    analysis,
    decision,
    diagnosisProblemId,
  };
}

export async function trackVisionEventAction(input: {
  event: "provider_selected" | "diagnosis_started";
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  await trackVisionAnalytics(input.event, input.metadata ?? {});
  return { success: true };
}
