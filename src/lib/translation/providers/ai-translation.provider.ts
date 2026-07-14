import type { Locale } from "@/lib/i18n/config";
import type { TranslationProvider } from "@/lib/translation/types";

const LOCALE_LABEL: Record<Locale, string> = {
  ar: "Arabic",
  en: "English",
};

export class AITranslationProvider implements TranslationProvider {
  readonly kind = "ai" as const;

  async translate(text: string, from: Locale, to: Locale): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) return "";
    if (from === to) return trimmed;

    const apiKey = process.env.TRANSLATION_API_KEY ?? process.env.OPENAI_API_KEY;
    const apiUrl =
      process.env.TRANSLATION_API_URL ?? "https://api.openai.com/v1/chat/completions";
    const model = process.env.TRANSLATION_MODEL ?? "gpt-4o-mini";

    if (!apiKey) {
      throw new Error(
        "Translation API key is not configured (set TRANSLATION_API_KEY or OPENAI_API_KEY).",
      );
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You translate business content for a local services marketplace. Translate from ${LOCALE_LABEL[from]} to ${LOCALE_LABEL[to]}. Return only the translated text with no quotes or commentary.`,
          },
          { role: "user", content: trimmed },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Translation request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const translated = payload.choices?.[0]?.message?.content?.trim();
    if (!translated) {
      throw new Error("Translation provider returned an empty response.");
    }

    return translated;
  }
}
