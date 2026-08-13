/**
 * Message translation — en / ar / de with auto language detection.
 */

import { createClient } from "@/lib/supabase/server";
import { detectLanguageHint, scrubAiText } from "@/lib/ai/privacy/scrub";
import { chatAiComplete } from "@/lib/ai/chat/llm";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isAiChatAssistantEnabled } from "@/lib/config/feature-flags";
import type { ChatAiLanguage, ChatTranslationResult } from "@/lib/ai/chat/types";

const LABEL: Record<ChatAiLanguage, string> = {
  en: "English",
  ar: "Arabic",
  de: "German",
};

function mapDetect(hint: string): string {
  if (hint === "ar") return "ar";
  if (hint === "en") return "en";
  // German heuristic
  return "und";
}

function detectDeHint(text: string): string {
  if (/[äöüßÄÖÜ]|\b(und|nicht|bitte|heute|morgen|kann)\b/i.test(text)) return "de";
  return mapDetect(detectLanguageHint(text));
}

export async function translateChatMessage(input: {
  conversationId: string;
  messageId: string;
  userId: string;
  text: string;
  targetLang: ChatAiLanguage;
}): Promise<ChatTranslationResult | null> {
  const detected = detectDeHint(input.text);
  if (detected === input.targetLang) {
    return {
      sourceLang: detected,
      targetLang: input.targetLang,
      translatedText: input.text,
      detectedLang: detected,
      aiGenerated: true,
    };
  }

  // Cache lookup
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cached } = await (supabase as any)
      .from("ai_chat_translations")
      .select("translated_text, source_lang, detected_lang")
      .eq("message_id", input.messageId)
      .eq("target_lang", input.targetLang)
      .maybeSingle();
    if (cached?.translated_text) {
      return {
        sourceLang: String(cached.source_lang ?? detected),
        targetLang: input.targetLang,
        translatedText: String(cached.translated_text),
        detectedLang: String(cached.detected_lang ?? detected),
        aiGenerated: true,
      };
    }
  } catch {
    /* continue */
  }

  const raw = await chatAiComplete({
    temperature: 0.1,
    system: [
      `Translate marketplace chat text to ${LABEL[input.targetLang]}.`,
      "Return only the translation. No quotes or commentary.",
      "Keep names and numbers. Do not invent content.",
    ].join(" "),
    user: scrubAiText(input.text).slice(0, 2000),
  });

  if (!raw) {
    // Minimal offline fallbacks for common phrases
    if (input.targetLang === "ar" && /when can you come/i.test(input.text)) {
      return {
        sourceLang: detected,
        targetLang: "ar",
        translatedText: "متى تستطيع المجيء؟",
        detectedLang: detected,
        aiGenerated: true,
      };
    }
    return null;
  }

  const result: ChatTranslationResult = {
    sourceLang: detected,
    targetLang: input.targetLang,
    translatedText: scrubAiText(raw),
    detectedLang: detected,
    aiGenerated: true,
  };

  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("ai_chat_translations").upsert({
      message_id: input.messageId,
      conversation_id: input.conversationId,
      source_lang: result.sourceLang,
      target_lang: result.targetLang,
      translated_text: result.translatedText,
      detected_lang: result.detectedLang,
      created_by: input.userId,
    });
  } catch {
    /* fail-soft */
  }

  if (isAiChatAssistantEnabled()) {
    void emitAiLearningEvent({
      eventType: "chat_ai_translation_used",
      customerId: input.userId,
      metadata: {
        conversationId: input.conversationId,
        target: input.targetLang,
        detected,
      },
    });
  }

  return result;
}
