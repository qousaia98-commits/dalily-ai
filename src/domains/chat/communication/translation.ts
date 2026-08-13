/**
 * AI-ready translation adapter.
 * Never overwrites the original message body — only returns a parallel view.
 */

import type { MessageTranslationView, TranslationTargetLocale } from "./types";
import {
  isAiChatAssistantEnabled,
  isAiTranslationEnabled,
} from "@/lib/config/feature-flags";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve a cached translation for display when AI translation is enabled.
 * Original message body is never mutated.
 */
export async function resolveMessageTranslation(input: {
  messageId: string;
  originalText: string;
  locale: TranslationTargetLocale;
}): Promise<MessageTranslationView | null> {
  if (!isAiChatAssistantEnabled() && !isAiTranslationEnabled()) return null;
  if (!input.originalText.trim()) return null;

  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("ai_chat_translations")
      .select("translated_text")
      .eq("message_id", input.messageId)
      .eq("target_lang", input.locale)
      .maybeSingle();

    if (data?.translated_text) {
      return {
        messageId: input.messageId,
        locale: input.locale,
        translatedText: String(data.translated_text),
        provider: "cache",
        originalPreserved: true,
      };
    }
  } catch {
    /* soft — table may be absent or RLS deny */
  }

  return null;
}

export function translationArchitectureNote(): string {
  return "Original message body is immutable; translations are parallel overlays.";
}
