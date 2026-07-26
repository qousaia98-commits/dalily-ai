/**
 * Sprint 5 Phase 3 — chat AI privacy preferences.
 * Private chat content is never used for model training.
 */

import { createClient } from "@/lib/supabase/server";
import type { ChatAiPreferences } from "@/lib/ai/chat/types";

const DEFAULTS: Omit<ChatAiPreferences, "userId"> = {
  aiEnabled: true,
  preferredLanguage: "auto",
  autoTranslate: false,
  allowSummaries: true,
  allowSuggestions: true,
  allowExtraction: true,
  allowVoiceTranscription: false,
};

export async function getChatAiPreferences(
  userId: string,
): Promise<ChatAiPreferences> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("ai_chat_preferences")
      .select(
        "user_id, ai_enabled, preferred_language, auto_translate, allow_summaries, allow_suggestions, allow_extraction, allow_voice_transcription",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      return { userId, ...DEFAULTS };
    }

    return {
      userId,
      aiEnabled: data.ai_enabled !== false,
      preferredLanguage: data.preferred_language ?? "auto",
      autoTranslate: Boolean(data.auto_translate),
      allowSummaries: data.allow_summaries !== false,
      allowSuggestions: data.allow_suggestions !== false,
      allowExtraction: data.allow_extraction !== false,
      allowVoiceTranscription: Boolean(data.allow_voice_transcription),
    };
  } catch {
    return { userId, ...DEFAULTS };
  }
}

export async function upsertChatAiPreferences(
  userId: string,
  patch: Partial<Omit<ChatAiPreferences, "userId">>,
): Promise<ChatAiPreferences> {
  const current = await getChatAiPreferences(userId);
  const next = { ...current, ...patch, userId };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("ai_chat_preferences").upsert({
    user_id: userId,
    ai_enabled: next.aiEnabled,
    preferred_language: next.preferredLanguage,
    auto_translate: next.autoTranslate,
    allow_summaries: next.allowSummaries,
    allow_suggestions: next.allowSuggestions,
    allow_extraction: next.allowExtraction,
    allow_voice_transcription: next.allowVoiceTranscription,
    voice_consent_at: next.allowVoiceTranscription
      ? new Date().toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });
  return next;
}

export function assertAiAllowed(
  prefs: ChatAiPreferences,
  feature: "summaries" | "suggestions" | "extraction" | "voice" | "any",
): boolean {
  if (!prefs.aiEnabled && feature !== "voice") return false;
  if (feature === "summaries") return prefs.allowSummaries;
  if (feature === "suggestions") return prefs.allowSuggestions;
  if (feature === "extraction") return prefs.allowExtraction;
  if (feature === "voice") return prefs.allowVoiceTranscription;
  return prefs.aiEnabled;
}
