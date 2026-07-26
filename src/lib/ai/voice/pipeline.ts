/**
 * Voice Intelligence pipeline:
 * validate → hash/cache → STT → language/dialect → smart transcript
 * → intent analysis → multimodal fusion → store
 */

import { isAiEngineV2Enabled, isAiEngineV6Enabled } from "@/lib/config/feature-flags";
import { runIntentPipeline } from "@/lib/ai/intent/pipeline";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  getVoiceByHash,
  upsertVoiceTranscript,
} from "./cache";
import { fuseVoiceTextImage } from "./fusion";
import { detectVoiceLanguage } from "./language";
import { buildSmartTranscript } from "./normalize";
import { speechToText } from "./stt";
import { contentHashFromAudio, validateVoiceAudio } from "./validate";
import type {
  MultimodalFusionResult,
  VoiceInterpretation,
  VoicePipelineResult,
} from "./types";

export type RunVoicePipelineInput = {
  bytes: ArrayBuffer;
  mimeType: string;
  /** Optional typed text to fuse (lower priority than voice). */
  typedText?: string | null;
  typedCategorySlug?: string | null;
  visionCategorySlug?: string | null;
  visionContradiction?: boolean;
  visionSummaryEn?: string | null;
  visionSummaryAr?: string | null;
  serviceRequestId?: string | null;
};

export type RunVoicePipelineOutcome =
  | { success: true; result: VoicePipelineResult }
  | {
      success: false;
      error:
        | "feature_disabled"
        | "empty"
        | "too_large"
        | "invalid_type"
        | "transcription_failed"
        | "no_api_key";
    };

function buildFallbackInterpretation(normalized: string): VoiceInterpretation {
  return {
    categorySlug: null,
    urgency: "normal",
    summaryEn: normalized
      ? `Customer said: ${normalized.slice(0, 140)}`
      : "Voice message received.",
    summaryAr: normalized
      ? `قال العميل: ${normalized.slice(0, 140)}`
      : "تم استلام رسالة صوتية.",
    confidence: 0.35,
    decision: null,
  };
}

async function interpretTranscript(
  normalized: string,
): Promise<VoiceInterpretation> {
  if (!isAiEngineV2Enabled() || normalized.length < 8) {
    return buildFallbackInterpretation(normalized);
  }

  try {
    const decision = await runIntentPipeline({ text: normalized });
    if (!decision) return buildFallbackInterpretation(normalized);

    const urgency =
      decision.urgency === "critical" || decision.urgency === "high"
        ? decision.urgency === "critical"
          ? "emergency"
          : "high"
        : decision.urgency === "low"
          ? "low"
          : "normal";

    const label = decision.categorySlug?.replace(/_/g, " ") ?? "service";
    return {
      categorySlug: decision.categorySlug,
      urgency,
      summaryEn: `Likely ${label} — ${decision.subcategory ?? decision.serviceType ?? "general help"}.`,
      summaryAr: `على الأرجح ${label} — ${decision.subcategory ?? "مساعدة عامة"}.`,
      confidence: decision.confidence,
      decision,
    };
  } catch {
    return buildFallbackInterpretation(normalized);
  }
}

function cachedToPipelineResult(
  cached: NonNullable<Awaited<ReturnType<typeof getVoiceByHash>>>,
  fusionOverride?: MultimodalFusionResult,
): VoicePipelineResult {
  const interpretation =
    cached.interpretation ??
    buildFallbackInterpretation(cached.normalizedTranscript);
  const language = cached.language ?? {
    language: "und" as const,
    dialect: "unknown" as const,
    confidence: 0.4,
    whisperLanguage: null,
  };
  const fusion =
    fusionOverride ??
    cached.fusion ??
    fuseVoiceTextImage({
      voiceNormalized: cached.editedTranscript || cached.normalizedTranscript,
      voiceInterpretation: interpretation,
    });

  return {
    transcriptId: cached.id,
    smart: {
      original: cached.originalTranscript,
      normalized: cached.normalizedTranscript,
      fillersRemoved: [],
    },
    language,
    interpretation,
    fusion,
    fromCache: true,
  };
}

export async function runVoiceIntelligencePipeline(
  input: RunVoicePipelineInput,
): Promise<RunVoicePipelineOutcome> {
  if (!isAiEngineV6Enabled()) {
    return { success: false, error: "feature_disabled" };
  }

  const validated = validateVoiceAudio({
    bytes: input.bytes,
    mimeType: input.mimeType,
  });
  if (!validated.ok) {
    return { success: false, error: validated.error };
  }

  const contentHash = contentHashFromAudio(validated.bytes);

  const cached = await getVoiceByHash(contentHash);
  if (cached) {
    void emitAiLearningEvent({
      eventType: "voice_cached",
      serviceRequestId: input.serviceRequestId,
      metadata: { transcriptId: cached.id, contentHash },
    });

    // Re-fuse with fresh typed/vision context if provided
    const interpretation =
      cached.interpretation ??
      buildFallbackInterpretation(
        cached.editedTranscript || cached.normalizedTranscript,
      );
    const fusion = fuseVoiceTextImage({
      voiceNormalized:
        cached.editedTranscript || cached.normalizedTranscript,
      voiceInterpretation: interpretation,
      typedText: input.typedText,
      typedCategorySlug: input.typedCategorySlug,
      visionCategorySlug: input.visionCategorySlug,
      visionContradiction: input.visionContradiction,
      visionSummaryEn: input.visionSummaryEn,
      visionSummaryAr: input.visionSummaryAr,
    });

    if (fusion.contradiction) {
      void emitAiLearningEvent({
        eventType: "voice_contradiction",
        serviceRequestId: input.serviceRequestId,
        metadata: { transcriptId: cached.id },
      });
    }

    return {
      success: true,
      result: cachedToPipelineResult(cached, fusion),
    };
  }

  const stt = await speechToText({
    bytes: validated.bytes,
    mimeType: validated.mimeType,
  });

  if (!stt.success) {
    void emitAiLearningEvent({
      eventType: "voice_stt_failed",
      serviceRequestId: input.serviceRequestId,
      metadata: { error: stt.error },
    });
    return {
      success: false,
      error: stt.error === "no_api_key" ? "no_api_key" : "transcription_failed",
    };
  }

  const smart = buildSmartTranscript(stt.text);
  const language = detectVoiceLanguage({
    transcript: smart.original,
    whisperLanguage: stt.language,
  });
  const interpretation = await interpretTranscript(smart.normalized);
  const fusion = fuseVoiceTextImage({
    voiceNormalized: smart.normalized,
    voiceInterpretation: interpretation,
    typedText: input.typedText,
    typedCategorySlug: input.typedCategorySlug,
    visionCategorySlug: input.visionCategorySlug,
    visionContradiction: input.visionContradiction,
    visionSummaryEn: input.visionSummaryEn,
    visionSummaryAr: input.visionSummaryAr,
  });

  if (fusion.contradiction) {
    void emitAiLearningEvent({
      eventType: "voice_contradiction",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        voiceCategory: interpretation.categorySlug,
        textCategory: input.typedCategorySlug,
        visionCategory: input.visionCategorySlug,
      },
    });
  } else {
    void emitAiLearningEvent({
      eventType: "voice_fused",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        categorySlug: fusion.categorySlug,
        urgency: fusion.urgency,
        sources: fusion.sourcePriority,
      },
    });
  }

  const transcriptId = await upsertVoiceTranscript({
    contentHash,
    smart,
    language,
    interpretation,
    fusion,
    mimeType: validated.mimeType,
    byteSize: validated.byteSize,
    serviceRequestId: input.serviceRequestId,
  });

  return {
    success: true,
    result: {
      transcriptId,
      smart,
      language,
      interpretation,
      fusion,
      fromCache: false,
    },
  };
}
