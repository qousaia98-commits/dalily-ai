"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isChatVoiceMessagingEnabled } from "@/lib/config/feature-flags";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  assertAiAllowed,
  deleteChatVoiceTranscript,
  getChatAiPreferences,
  getTranscriptForMessage,
  persistChatVoiceTranscript,
  searchChatVoiceTranscripts,
  transcribeChatVoiceBlob,
  translateChatVoiceTranscript,
  upsertChatAiPreferences,
  buildWaveformPeaks,
} from "@/lib/ai/chat";
import {
  finalizeChatMediaUploadAction,
  prepareChatMediaUploadAction,
} from "@/actions/media.actions";
import type { ChatAiLanguage } from "@/lib/ai/chat/types";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { logger } from "@/lib/observability/logger";

async function assertParticipant(conversationId: string, userId: string) {
  const { assertChatParticipants } = await import("@/domains/chat/authz");
  const { isChatAuthV2Enabled } = await import("@/lib/config/feature-flags");
  if (isChatAuthV2Enabled()) {
    const gate = await assertChatParticipants({ conversationId, userId });
    if (!gate.ok) return { ok: false as const, error: gate.error };
    return { ok: true as const };
  }
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, provider_id, customer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { ok: false as const, error: "not_found" as const };
  const { data: providerRow } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", conv.provider_id)
    .maybeSingle();
  if (userId !== conv.customer_id && userId !== providerRow?.owner_id) {
    return { ok: false as const, error: "forbidden" as const };
  }
  return { ok: true as const };
}

/**
 * Upload + send a voice message, optionally auto-transcribe when consent is on.
 * Never starts a live call.
 */
export async function sendChatVoiceMessageAction(formData: FormData) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, error: "login_required" };
  if (!isChatVoiceMessagingEnabled()) {
    return { success: false as const, error: "feature_disabled" };
  }

  const conversationId = String(formData.get("conversationId") ?? "");
  const durationMs = Number(formData.get("durationMs") ?? 0) || null;
  const file = formData.get("audio");
  if (!conversationId || !(file instanceof File) || file.size <= 0) {
    return { success: false as const, error: "validation_error" };
  }

  const gate = await assertParticipant(conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, error: gate.error };

  const rate = checkRateLimit(rateLimitKey("chat_voice", authUser.id), {
    max: 15,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    logger.warn("chat_voice", "rate_limited", { userId: authUser.id });
    return { success: false as const, error: "rate_limited" };
  }

  const mimeType = file.type || "audio/webm";
  const slot = await prepareChatMediaUploadAction({
    conversationId,
    fileName: file.name || "voice-message.webm",
    mimeType,
    sizeBytes: file.size,
  });
  if (!slot.success) {
    return { success: false as const, error: slot.error ?? "prepare_failed" };
  }

  const supabase = await createClient();
  const { error: upErr } = await supabase.storage
    .from(slot.bucket)
    .upload(slot.path, file, { contentType: mimeType, upsert: false });
  if (upErr) return { success: false as const, error: "upload_failed" };

  const finalized = await finalizeChatMediaUploadAction({
    conversationId,
    path: slot.path,
    bucket: slot.bucket,
    fileName: file.name || "voice-message.webm",
    mimeType,
    sizeBytes: file.size,
    bodyText: "Voice message",
    durationMs,
    clientId: crypto.randomUUID(),
  });
  if (!finalized.success) {
    return { success: false as const, error: finalized.error ?? "finalize_failed" };
  }

  void emitAiLearningEvent({
    eventType: "chat_voice_recorded",
    customerId: authUser.id,
    metadata: {
      conversationId,
      durationMs,
      sizeBytes: file.size,
    },
  });

  // Waveform placeholder peaks on attachment
  if (finalized.attachmentId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("message_attachments")
      .update({
        duration_ms: durationMs,
        waveform_peaks: buildWaveformPeaks(40),
      })
      .eq("id", finalized.attachmentId);
  }

  const prefs = await getChatAiPreferences(authUser.id);
  let transcriptId: string | null = null;

  if (assertAiAllowed(prefs, "voice")) {
    const bytes = await file.arrayBuffer();
    const stt = await transcribeChatVoiceBlob({
      bytes,
      mimeType,
      fileName: file.name || "voice-message.webm",
    });
    if (stt.success && finalized.messageId) {
      const row = await persistChatVoiceTranscript({
        conversationId,
        messageId: finalized.messageId,
        attachmentId: finalized.attachmentId ?? null,
        userId: authUser.id,
        transcriptText: stt.text,
        language: stt.language,
        durationMs,
        withSummary: true,
      });
      transcriptId = row?.id ?? null;
    }
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/business/messages/${conversationId}`);

  return {
    success: true as const,
    messageId: finalized.messageId,
    attachmentId: finalized.attachmentId,
    transcriptId,
  };
}

export async function setChatVoiceConsentAction(consent: boolean) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  await upsertChatAiPreferences(authUser.id, {
    allowVoiceTranscription: consent,
  });
  void emitAiLearningEvent({
    eventType: consent
      ? "chat_voice_consent_granted"
      : "chat_voice_consent_revoked",
    customerId: authUser.id,
    metadata: {},
  });
  return { success: true };
}

export async function getChatVoiceTranscriptAction(messageId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, transcript: null };
  const transcript = await getTranscriptForMessage(messageId);
  if (!transcript) return { success: false as const, transcript: null };
  const gate = await assertParticipant(transcript.conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, transcript: null };
  return { success: true as const, transcript };
}

export async function deleteChatVoiceTranscriptAction(input: {
  transcriptId: string;
  conversationId: string;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false };
  const ok = await deleteChatVoiceTranscript({
    ...input,
    userId: authUser.id,
  });
  revalidatePath(`/messages/${input.conversationId}`);
  revalidatePath(`/business/messages/${input.conversationId}`);
  return { success: ok };
}

export async function translateChatVoiceTranscriptAction(input: {
  transcriptId: string;
  conversationId: string;
  targetLang: ChatAiLanguage;
  sourceText: string;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, text: null };
  const prefs = await getChatAiPreferences(authUser.id);
  if (!assertAiAllowed(prefs, "voice")) {
    return { success: false as const, text: null, error: "consent_required" };
  }
  const gate = await assertParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, text: null };
  const text = await translateChatVoiceTranscript({
    ...input,
    userId: authUser.id,
  });
  return { success: Boolean(text), text };
}

export async function searchChatVoiceTranscriptsAction(input: {
  query: string;
  conversationId?: string | null;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, hits: [] };
  if (!isChatVoiceMessagingEnabled()) {
    return { success: false as const, hits: [] };
  }
  const hits = await searchChatVoiceTranscripts({
    userId: authUser.id,
    query: input.query,
    conversationId: input.conversationId,
  });
  return { success: true as const, hits };
}

export async function trackChatVoicePlayedAction(input: {
  conversationId: string;
  messageId?: string;
}) {
  const authUser = await getAuthUser();
  if (!authUser || !isChatVoiceMessagingEnabled()) return { success: false };
  void emitAiLearningEvent({
    eventType: "chat_voice_played",
    customerId: authUser.id,
    metadata: input,
  });
  return { success: true };
}
