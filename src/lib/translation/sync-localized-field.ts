import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";
import type { SyncLocalizedFieldInput, TranslationProvider } from "@/lib/translation/types";

/**
 * Builds a bilingual JSON field from a single source locale.
 * Translation is best-effort: on any provider failure the opposite
 * language is left empty and the original language is always preserved.
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
    result[targetLocale] = await provider.translate(sourceText, sourceLocale, targetLocale);
  } catch (error) {
    console.error("[translation] syncLocalizedField failed — keeping source language only", {
      sourceLocale,
      targetLocale,
      message: error instanceof Error ? error.message : String(error),
    });
    // Do not invent a copy; leave the opposite language empty.
    result[targetLocale] = "";
  }

  return result;
}
