import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";
import type { SyncLocalizedFieldInput, TranslationProvider } from "@/lib/translation/types";

/**
 * Builds a bilingual JSON field from a single source locale.
 * Translation is best-effort: on provider failure the existing target
 * locale (if any) is preserved and never overwritten with an empty string.
 */
export async function syncLocalizedField(
  provider: TranslationProvider,
  input: SyncLocalizedFieldInput,
): Promise<LocalizedJson> {
  const sourceText = input.sourceText.trim();
  const sourceLocale = input.sourceLocale;
  const targetLocale: Locale = sourceLocale === "ar" ? "en" : "ar";

  const existing = {
    ar: (input.existing.ar ?? "").trim(),
    en: (input.existing.en ?? "").trim(),
  };

  const result: LocalizedJson = {
    ar: existing.ar,
    en: existing.en,
    [sourceLocale]: sourceText,
  };

  if (!sourceText) {
    return result;
  }

  const sourceChanged = existing[sourceLocale] !== sourceText;
  const targetEmpty = !existing[targetLocale];

  if (!targetEmpty && !sourceChanged) {
    return result;
  }

  try {
    const translated = (await provider.translate(sourceText, sourceLocale, targetLocale)).trim();
    // Never persist an empty translation over an existing good value.
    if (translated) {
      result[targetLocale] = translated;
    }
  } catch (error) {
    console.error("[translation] syncLocalizedField failed — keeping source language only", {
      sourceLocale,
      targetLocale,
      message: error instanceof Error ? error.message : String(error),
    });
    // Keep any existing target translation; do not overwrite with "".
  }

  return result;
}
