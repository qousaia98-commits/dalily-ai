/**
 * Cache voice transcripts by audio content hash — skip duplicate STT.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type {
  MultimodalFusionResult,
  SmartTranscript,
  VoiceInterpretation,
  VoiceLanguageDetection,
  VoiceProviderPreview,
} from "./types";
import { SERVICE_REQUEST_MEDIA_BUCKET } from "@/lib/service-requests/constants";

const VOICE_SELECT =
  "id, original_transcript, normalized_transcript, edited_transcript, language, dialect, language_confidence, interpretation, fusion, detected_category_slug, detected_urgency, summary_en, summary_ar, audio_path, audio_bucket, confidence, customer_confirmed";

export type CachedVoiceRow = {
  id: string;
  originalTranscript: string;
  normalizedTranscript: string;
  editedTranscript: string | null;
  language: VoiceLanguageDetection | null;
  interpretation: VoiceInterpretation | null;
  fusion: MultimodalFusionResult | null;
  categorySlug: string | null;
  urgency: string | null;
  summaryEn: string | null;
  summaryAr: string | null;
  audioPath: string | null;
  audioBucket: string | null;
  confidence: number | null;
  customerConfirmed: boolean | null;
};

function mapRow(data: Record<string, unknown>): CachedVoiceRow {
  const lang = data.language
    ? ({
        language: data.language as VoiceLanguageDetection["language"],
        dialect: (data.dialect as VoiceLanguageDetection["dialect"]) ?? "unknown",
        confidence: Number(data.language_confidence ?? 0.5),
        whisperLanguage: null,
      } satisfies VoiceLanguageDetection)
    : null;

  return {
    id: data.id as string,
    originalTranscript: data.original_transcript as string,
    normalizedTranscript: data.normalized_transcript as string,
    editedTranscript: (data.edited_transcript as string | null) ?? null,
    language: lang,
    interpretation: (data.interpretation as VoiceInterpretation | null) ?? null,
    fusion: (data.fusion as MultimodalFusionResult | null) ?? null,
    categorySlug: (data.detected_category_slug as string | null) ?? null,
    urgency: (data.detected_urgency as string | null) ?? null,
    summaryEn: (data.summary_en as string | null) ?? null,
    summaryAr: (data.summary_ar as string | null) ?? null,
    audioPath: (data.audio_path as string | null) ?? null,
    audioBucket: (data.audio_bucket as string | null) ?? null,
    confidence: data.confidence != null ? Number(data.confidence) : null,
    customerConfirmed: (data.customer_confirmed as boolean | null) ?? null,
  };
}

export async function getVoiceByHash(
  contentHash: string,
): Promise<CachedVoiceRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_voice_transcripts")
      .select(VOICE_SELECT)
      .eq("content_hash", contentHash)
      .maybeSingle();
    if (!data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function upsertVoiceTranscript(input: {
  contentHash: string;
  smart: SmartTranscript;
  language: VoiceLanguageDetection;
  interpretation: VoiceInterpretation;
  fusion: MultimodalFusionResult;
  mimeType?: string;
  byteSize?: number;
  serviceRequestId?: string | null;
}): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const row = {
      content_hash: input.contentHash,
      original_transcript: input.smart.original,
      normalized_transcript: input.smart.normalized,
      language: input.language.language,
      dialect: input.language.dialect,
      language_confidence: input.language.confidence,
      interpretation: input.interpretation as unknown as Json,
      fusion: input.fusion as unknown as Json,
      detected_category_slug: input.fusion.categorySlug,
      detected_urgency: input.fusion.urgency,
      summary_en: input.fusion.summaryEn,
      summary_ar: input.fusion.summaryAr,
      confidence: input.fusion.fusedConfidence,
      mime_type: input.mimeType ?? null,
      byte_size: input.byteSize ?? null,
      service_request_id: input.serviceRequestId ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("ai_voice_transcripts")
      .upsert(row as never, { onConflict: "content_hash" })
      .select("id")
      .single();

    if (error || !data) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ai.voice.cache] upsert failed", error?.message);
      }
      return null;
    }

    void emitAiLearningEvent({
      eventType: "voice_transcribed",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        transcriptId: data.id,
        language: input.language.language,
        dialect: input.language.dialect,
        categorySlug: input.fusion.categorySlug,
        confidence: input.fusion.fusedConfidence,
      },
    });

    void emitAiLearningEvent({
      eventType: "voice_language_detected",
      serviceRequestId: input.serviceRequestId,
      metadata: {
        language: input.language.language,
        dialect: input.language.dialect,
        confidence: input.language.confidence,
        whisperLanguage: input.language.whisperLanguage,
      },
    });

    return data.id as string;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai.voice.cache]", error);
    }
    return null;
  }
}

export async function attachVoiceToRequest(input: {
  transcriptId: string;
  serviceRequestId: string;
  audioPath?: string | null;
  audioBucket?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const patch: Record<string, unknown> = {
      service_request_id: input.serviceRequestId,
      updated_at: new Date().toISOString(),
    };
    if (input.audioPath) {
      patch.audio_path = input.audioPath;
      patch.audio_bucket = input.audioBucket ?? SERVICE_REQUEST_MEDIA_BUCKET;
    }
    await admin
      .from("ai_voice_transcripts")
      .update(patch as never)
      .eq("id", input.transcriptId);
  } catch {
    // non-blocking
  }
}

export async function confirmVoiceTranscript(input: {
  transcriptId: string;
  confirmed: boolean;
  editedTranscript?: string | null;
  correction?: string | null;
  finalCategorySlug?: string | null;
  customerId?: string | null;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const patch: Record<string, unknown> = {
      customer_confirmed: input.confirmed,
      customer_correction: input.correction?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (input.editedTranscript?.trim()) {
      patch.edited_transcript = input.editedTranscript.trim();
      void emitAiLearningEvent({
        eventType: "voice_transcript_edited",
        customerId: input.customerId,
        metadata: { transcriptId: input.transcriptId },
      });
    }
    if (input.finalCategorySlug) {
      patch.final_category_slug = input.finalCategorySlug;
    }

    const { error } = await admin
      .from("ai_voice_transcripts")
      .update(patch as never)
      .eq("id", input.transcriptId);

    if (error) return false;

    void emitAiLearningEvent({
      eventType: input.confirmed ? "voice_confirmed" : "voice_corrected",
      customerId: input.customerId,
      metadata: {
        transcriptId: input.transcriptId,
        finalCategorySlug: input.finalCategorySlug ?? null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function getLatestVoiceForRequest(
  serviceRequestId: string,
): Promise<CachedVoiceRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_voice_transcripts")
      .select(VOICE_SELECT)
      .eq("service_request_id", serviceRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getVoiceProviderPreview(
  serviceRequestId: string,
): Promise<VoiceProviderPreview | null> {
  const row = await getLatestVoiceForRequest(serviceRequestId);
  if (!row) return null;

  let audioUrl: string | null = null;
  if (row.audioPath) {
    try {
      const admin = createAdminClient();
      const bucket = row.audioBucket ?? SERVICE_REQUEST_MEDIA_BUCKET;
      const { data } = await admin.storage
        .from(bucket)
        .createSignedUrl(row.audioPath, 3600);
      audioUrl = data?.signedUrl ?? null;
    } catch {
      audioUrl = null;
    }
  }

  return {
    transcriptId: row.id,
    originalTranscript: row.originalTranscript,
    normalizedTranscript: row.normalizedTranscript,
    editedTranscript: row.editedTranscript,
    language: row.language?.language ?? null,
    dialect: row.language?.dialect ?? null,
    categorySlug: row.categorySlug,
    urgency: row.urgency,
    summaryEn: row.summaryEn,
    summaryAr: row.summaryAr,
    audioUrl,
    confidence: row.confidence,
  };
}
