"use server";

/**
 * AI Engine Phase 6 — Intent Voice actions.
 */

import { getAuthUser } from "@/lib/auth/session";
import { isSpeechEngineEnabled } from "@/lib/config/feature-flags";
import {
  runVoiceIntelligencePipeline,
  confirmVoiceTranscript,
  isAllowedVoiceMime,
  VOICE_MAX_AUDIO_BYTES,
  type MultimodalFusionResult,
  type VoiceLanguageDetection,
} from "@/domains/speech";

export type AnalyzeIntentVoiceActionResult =
  | {
      success: true;
      transcriptId: string | null;
      fromCache: boolean;
      originalTranscript: string;
      normalizedTranscript: string;
      language: VoiceLanguageDetection;
      categorySlug: string | null;
      urgency: string;
      summaryEn: string;
      summaryAr: string;
      contradiction: boolean;
      needsClarification: boolean;
      fusedConfidence: number;
      fusion: MultimodalFusionResult;
    }
  | {
      success: false;
      error:
        | "feature_disabled"
        | "no_audio"
        | "file_too_large"
        | "invalid_file_type"
        | "transcription_failed"
        | "no_api_key";
    };

export async function analyzeIntentVoiceAction(
  formData: FormData,
): Promise<AnalyzeIntentVoiceActionResult> {
  if (!isSpeechEngineEnabled()) {
    return { success: false, error: "feature_disabled" };
  }

  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "no_audio" };
  }
  if (file.size > VOICE_MAX_AUDIO_BYTES) {
    return { success: false, error: "file_too_large" };
  }
  const mime = file.type || "audio/webm";
  if (!isAllowedVoiceMime(mime)) {
    return { success: false, error: "invalid_file_type" };
  }

  const typedText = String(formData.get("typedText") ?? "") || null;
  const typedCategorySlug =
    String(formData.get("categorySlug") ?? "") || null;
  const visionCategorySlug =
    String(formData.get("visionCategorySlug") ?? "") || null;

  const bytes = await file.arrayBuffer();
  const outcome = await runVoiceIntelligencePipeline({
    bytes,
    mimeType: mime,
    typedText,
    typedCategorySlug,
    visionCategorySlug,
  });

  if (!outcome.success) {
    const mapped =
      outcome.error === "empty"
        ? "no_audio"
        : outcome.error === "too_large"
          ? "file_too_large"
          : outcome.error === "invalid_type"
            ? "invalid_file_type"
            : outcome.error;
    return { success: false, error: mapped };
  }

  const { result } = outcome;
  return {
    success: true,
    transcriptId: result.transcriptId,
    fromCache: result.fromCache,
    originalTranscript: result.smart.original,
    normalizedTranscript: result.smart.normalized,
    language: result.language,
    categorySlug: result.fusion.categorySlug,
    urgency: result.fusion.urgency,
    summaryEn: result.fusion.summaryEn,
    summaryAr: result.fusion.summaryAr,
    contradiction: result.fusion.contradiction,
    needsClarification: result.fusion.needsClarification,
    fusedConfidence: result.fusion.fusedConfidence,
    fusion: result.fusion,
  };
}

export async function confirmIntentVoiceAction(input: {
  transcriptId: string;
  confirmed: boolean;
  editedTranscript?: string;
  correction?: string;
  finalCategorySlug?: string;
}): Promise<{ success: boolean }> {
  if (!isSpeechEngineEnabled()) return { success: false };
  if (!input.transcriptId) return { success: false };

  const authUser = await getAuthUser();
  const ok = await confirmVoiceTranscript({
    transcriptId: input.transcriptId,
    confirmed: input.confirmed,
    editedTranscript: input.editedTranscript,
    correction: input.correction,
    finalCategorySlug: input.finalCategorySlug,
    customerId: authUser?.id ?? null,
  });
  return { success: ok };
}
