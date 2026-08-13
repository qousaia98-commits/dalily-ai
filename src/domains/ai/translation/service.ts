/**
 * Translation facade — never overwrites originals.
 */

import {
  isAiPlatformEnabled,
  isAiTranslationEnabled,
} from "@/lib/config/feature-flags";
import { translateChatMessage } from "@/lib/ai/chat/translate";
import type { ChatAiLanguage } from "@/lib/ai/chat/types";
import type { AiTranslationView } from "@/domains/ai/shared/types";

export async function translateText(input: {
  conversationId: string;
  messageId: string;
  userId: string;
  text: string;
  targetLang: ChatAiLanguage;
}): Promise<AiTranslationView | null> {
  if (!isAiPlatformEnabled() || !isAiTranslationEnabled()) return null;

  const result = await translateChatMessage(input);
  if (!result) return null;

  return {
    originalText: input.text,
    translatedText: result.translatedText,
    detectedLanguage: result.detectedLang ?? result.sourceLang,
    targetLanguage: result.targetLang,
    confidence: result.translatedText === input.text ? 1 : 0.75,
    provider: "llm_cache",
    originalPreserved: true,
  };
}

export { resolveMessageTranslation } from "@/domains/chat/communication/translation";
