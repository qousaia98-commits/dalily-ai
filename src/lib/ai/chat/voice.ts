/**
 * Sprint 5 Phase 4 — chat voice STT, summary, translation, search.
 * Original recordings stay in private storage; transcripts are deletable.
 * Never used for model training.
 */

import { createClient } from "@/lib/supabase/server";
import { speechToText } from "@/lib/ai/voice/stt";
import { scrubAiText } from "@/lib/ai/privacy/scrub";
import { chatAiComplete, parseJsonObject } from "@/lib/ai/chat/llm";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isChatVoiceMessagingEnabled } from "@/lib/config/feature-flags";
import type { ChatAiLanguage } from "@/lib/ai/chat/types";
import type {
  ChatVoiceSearchHit,
  ChatVoiceTranscript,
} from "@/lib/ai/chat/voice-types";

const CHAT_VOICE_MAX_BYTES = 5 * 1024 * 1024;

export async function transcribeChatVoiceBlob(input: {
  bytes: ArrayBuffer;
  mimeType: string;
  fileName?: string;
}): Promise<
  | { success: true; text: string; language: string | null }
  | { success: false; error: string }
> {
  if (!input.bytes.byteLength) return { success: false, error: "empty" };
  if (input.bytes.byteLength > CHAT_VOICE_MAX_BYTES) {
    return { success: false, error: "too_large" };
  }
  const stt = await speechToText({
    bytes: input.bytes,
    mimeType: input.mimeType || "audio/webm",
    fileName: input.fileName,
  });
  if (!stt.success) return { success: false, error: stt.error };
  return {
    success: true,
    text: scrubAiText(stt.text),
    language: stt.language,
  };
}

async function summarizeTranscript(text: string): Promise<{
  summary: string;
  bullets: string[];
  extracted: Array<{ fieldKey: string; fieldValue: string; confidence: number }>;
}> {
  const fallbackBullets: string[] = [];
  const lower = text.toLowerCase();
  if (/appointment|موعد|tomorrow|بكرة|اليوم/.test(lower)) {
    fallbackBullets.push("Appointment discussed");
  }
  if (/budget|سعر|كم|SYP|USD/.test(lower)) {
    fallbackBullets.push("Budget discussed");
  }
  if (/address|عنوان|location/.test(lower)) {
    fallbackBullets.push("Address mentioned");
  }
  if (/material|مواد/.test(lower)) {
    fallbackBullets.push("Materials required");
  }
  if (!fallbackBullets.length) fallbackBullets.push("Voice note captured");

  const raw = await chatAiComplete({
    temperature: 0.2,
    system: [
      "Summarize a marketplace voice-message transcript for Dalily.",
      'Return ONLY JSON: {"summary":"...","bullets":[],"extracted":[{"fieldKey","fieldValue","confidence"}]}',
      "fieldKey in: appointment,address,phone,budget,service_type,materials,urgency,other",
      "Scrub phones. Short bullets. English preferred.",
    ].join(" "),
    user: text.slice(0, 3000),
  });

  const parsed = parseJsonObject<{
    summary?: string;
    bullets?: string[];
    extracted?: Array<{
      fieldKey?: string;
      fieldValue?: string;
      confidence?: number;
    }>;
  }>(raw);

  return {
    summary: scrubAiText(parsed?.summary || fallbackBullets.join(" · ")),
    bullets: (parsed?.bullets?.length ? parsed.bullets : fallbackBullets)
      .map(scrubAiText)
      .slice(0, 6),
    extracted: (parsed?.extracted ?? [])
      .map((e) => ({
        fieldKey: e.fieldKey || "other",
        fieldValue: scrubAiText(e.fieldValue || ""),
        confidence: Math.min(1, Math.max(0, Number(e.confidence ?? 0.5))),
      }))
      .filter((e) => e.fieldValue)
      .slice(0, 8),
  };
}

export async function persistChatVoiceTranscript(input: {
  conversationId: string;
  messageId: string;
  attachmentId?: string | null;
  mediaObjectId?: string | null;
  userId: string;
  transcriptText: string;
  language: string | null;
  durationMs?: number | null;
  withSummary?: boolean;
}): Promise<ChatVoiceTranscript | null> {
  const summary = input.withSummary
    ? await summarizeTranscript(input.transcriptText)
    : { summary: "", bullets: [] as string[], extracted: [] };

  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("chat_voice_transcripts")
      .upsert(
        {
          conversation_id: input.conversationId,
          message_id: input.messageId,
          attachment_id: input.attachmentId ?? null,
          media_object_id: input.mediaObjectId ?? null,
          language: input.language,
          transcript_text: input.transcriptText,
          summary_text: summary.summary || null,
          summary_bullets: summary.bullets,
          extracted: summary.extracted,
          status: "ready",
          duration_ms: input.durationMs ?? null,
          created_by: input.userId,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        { onConflict: "message_id" },
      )
      .select(
        "id, conversation_id, message_id, attachment_id, language, transcript_text, summary_text, summary_bullets, extracted, status, duration_ms, created_at",
      )
      .single();

    if (error || !data) return null;

    if (input.attachmentId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("message_attachments")
        .update({
          transcript_id: data.id,
          duration_ms: input.durationMs ?? null,
        })
        .eq("id", input.attachmentId);
    }

    if (input.mediaObjectId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("media_objects")
        .update({
          transcription_ready: true,
          transcription_text: input.transcriptText,
          transcription_language: input.language,
          processing_status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.mediaObjectId);
    }

    if (isChatVoiceMessagingEnabled()) {
      void emitAiLearningEvent({
        eventType: "chat_voice_transcript_generated",
        customerId: input.userId,
        metadata: {
          conversationId: input.conversationId,
          messageId: input.messageId,
          language: input.language,
        },
      });
      if (input.withSummary && summary.summary) {
        void emitAiLearningEvent({
          eventType: "chat_voice_summary_generated",
          customerId: input.userId,
          metadata: { conversationId: input.conversationId },
        });
      }
    }

    return mapTranscript(data);
  } catch {
    return null;
  }
}

function mapTranscript(row: Record<string, unknown>): ChatVoiceTranscript {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    messageId: String(row.message_id),
    attachmentId: (row.attachment_id as string | null) ?? null,
    language: (row.language as string | null) ?? null,
    transcriptText: String(row.transcript_text ?? ""),
    summaryText: (row.summary_text as string | null) ?? null,
    summaryBullets: Array.isArray(row.summary_bullets)
      ? (row.summary_bullets as string[])
      : [],
    extracted: Array.isArray(row.extracted)
      ? (row.extracted as ChatVoiceTranscript["extracted"])
      : [],
    status: (row.status as ChatVoiceTranscript["status"]) || "ready",
    durationMs: (row.duration_ms as number | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function getTranscriptForMessage(
  messageId: string,
): Promise<ChatVoiceTranscript | null> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("chat_voice_transcripts")
      .select(
        "id, conversation_id, message_id, attachment_id, language, transcript_text, summary_text, summary_bullets, extracted, status, duration_ms, created_at",
      )
      .eq("message_id", messageId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return null;
    return mapTranscript(data);
  } catch {
    return null;
  }
}

export async function deleteChatVoiceTranscript(input: {
  transcriptId: string;
  conversationId: string;
  userId: string;
}): Promise<boolean> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("chat_voice_transcripts")
      .update({
        deleted_at: new Date().toISOString(),
        status: "deleted",
        transcript_text: "",
        summary_text: null,
        summary_bullets: [],
        extracted: [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.transcriptId)
      .eq("conversation_id", input.conversationId);
    if (error) return false;
    if (isChatVoiceMessagingEnabled()) {
      void emitAiLearningEvent({
        eventType: "chat_voice_transcript_deleted",
        customerId: input.userId,
        metadata: {
          conversationId: input.conversationId,
          transcriptId: input.transcriptId,
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function translateChatVoiceTranscript(input: {
  transcriptId: string;
  conversationId: string;
  userId: string;
  targetLang: ChatAiLanguage;
  sourceText: string;
}): Promise<string | null> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cached } = await (supabase as any)
      .from("chat_voice_transcript_translations")
      .select("translated_text")
      .eq("transcript_id", input.transcriptId)
      .eq("target_lang", input.targetLang)
      .maybeSingle();
    if (cached?.translated_text) return String(cached.translated_text);

    const labels = { en: "English", ar: "Arabic", de: "German" } as const;
    const raw = await chatAiComplete({
      temperature: 0.1,
      system: `Translate the voice transcript to ${labels[input.targetLang]}. Return only the translation.`,
      user: scrubAiText(input.sourceText).slice(0, 3000),
    });
    if (!raw) return null;
    const translated = scrubAiText(raw);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("chat_voice_transcript_translations").upsert({
      transcript_id: input.transcriptId,
      conversation_id: input.conversationId,
      target_lang: input.targetLang,
      translated_text: translated,
      created_by: input.userId,
    });

    if (isChatVoiceMessagingEnabled()) {
      void emitAiLearningEvent({
        eventType: "chat_voice_translation_used",
        customerId: input.userId,
        metadata: {
          conversationId: input.conversationId,
          target: input.targetLang,
        },
      });
    }

    return translated;
  } catch {
    return null;
  }
}

export async function searchChatVoiceTranscripts(input: {
  userId: string;
  query: string;
  conversationId?: string | null;
}): Promise<ChatVoiceSearchHit[]> {
  const q = input.query.trim();
  if (q.length < 2) return [];
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      "search_chat_voice_transcripts",
      {
        p_user_id: input.userId,
        p_query: q,
        p_conversation_id: input.conversationId ?? null,
        p_limit: 30,
      },
    );
    if (error || !data) return [];

    if (isChatVoiceMessagingEnabled()) {
      void emitAiLearningEvent({
        eventType: "chat_voice_transcript_searched",
        customerId: input.userId,
        metadata: {
          qLen: q.length,
          hits: (data as unknown[]).length,
          conversationId: input.conversationId,
        },
      });
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      conversationId: String(r.conversation_id),
      messageId: String(r.message_id),
      transcriptText: String(r.transcript_text ?? ""),
      summaryText: (r.summary_text as string | null) ?? null,
      language: (r.language as string | null) ?? null,
      createdAt: String(r.created_at),
    }));
  } catch {
    return [];
  }
}

/** Simple peak samples 0–1 for waveform UI. */
export function buildWaveformPeaks(
  sampleCount = 32,
): number[] {
  // Placeholder peaks until a DSP worker exists — UI still shows bars.
  return Array.from({ length: sampleCount }, (_, i) => {
    const t = i / sampleCount;
    return 0.25 + 0.55 * Math.abs(Math.sin(t * Math.PI * 3));
  });
}
