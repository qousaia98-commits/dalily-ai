"use server";

/**
 * AI Engine Phase 5 — Intent Vision actions (customer photo confirm path).
 */

import { getAuthUser } from "@/lib/auth/session";
import { isAiEngineV5Enabled } from "@/lib/config/feature-flags";
import { runVisionIntelligencePipeline } from "@/lib/ai/vision/pipeline";
import { confirmVisionAnalysis } from "@/lib/ai/vision/cache";
import {
  VISION_ALLOWED_MIME,
  VISION_MAX_IMAGE_BYTES,
} from "@/lib/vision/constants";
import type { VisionTextFusionResult } from "@/lib/ai/vision/types";

export type AnalyzeIntentVisionActionResult =
  | {
      success: true;
      analysisId: string | null;
      fromCache: boolean;
      summaryEn: string;
      summaryAr: string;
      contradiction: boolean;
      needsClarification: boolean;
      fusedConfidence: number;
      objects: string[];
      damages: string[];
      estimatedRisk: string;
      fusion: VisionTextFusionResult;
    }
  | {
      success: false;
      error:
        | "feature_disabled"
        | "no_image"
        | "file_too_large"
        | "invalid_file_type"
        | "analysis_failed"
        | "no_api_key";
    };

export async function analyzeIntentVisionAction(
  formData: FormData,
): Promise<AnalyzeIntentVisionActionResult> {
  if (!isAiEngineV5Enabled()) {
    return { success: false, error: "feature_disabled" };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "no_image" };
  }
  if (file.size > VISION_MAX_IMAGE_BYTES) {
    return { success: false, error: "file_too_large" };
  }
  const mime = file.type || "image/jpeg";
  if (!(VISION_ALLOWED_MIME as readonly string[]).includes(mime)) {
    return { success: false, error: "invalid_file_type" };
  }

  const intentText = String(formData.get("intentText") ?? "");
  const textCategorySlug =
    String(formData.get("categorySlug") ?? "") || null;

  const bytes = await file.arrayBuffer();
  const result = await runVisionIntelligencePipeline({
    bytes,
    mimeType: mime,
    intentText,
    textCategorySlug,
  });

  if (!result.success) {
    const mapped =
      result.error === "empty"
        ? "no_image"
        : result.error === "too_large"
          ? "file_too_large"
          : result.error === "invalid_type"
            ? "invalid_file_type"
            : result.error;
    return { success: false, error: mapped };
  }

  const { fusion, analysisId, fromCache } = result;
  return {
    success: true,
    analysisId,
    fromCache,
    summaryEn: fusion.customerSummaryEn,
    summaryAr: fusion.customerSummaryAr,
    contradiction: fusion.contradiction,
    needsClarification: fusion.needsClarification,
    fusedConfidence: fusion.fusedConfidence,
    objects: fusion.analysis.objects.map((o) => o.name),
    damages: fusion.analysis.damages.map((d) => d.type),
    estimatedRisk: fusion.analysis.estimatedRisk,
    fusion,
  };
}

export async function confirmIntentVisionAction(input: {
  analysisId: string;
  confirmed: boolean;
  correction?: string;
}): Promise<{ success: boolean }> {
  if (!isAiEngineV5Enabled()) return { success: false };
  if (!input.analysisId) return { success: false };

  const authUser = await getAuthUser();
  const ok = await confirmVisionAnalysis({
    analysisId: input.analysisId,
    confirmed: input.confirmed,
    correction: input.correction,
    customerId: authUser?.id ?? null,
  });
  return { success: ok };
}
