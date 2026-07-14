import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";
import type { SyncLocalizedFieldInput, TranslationProvider } from "@/lib/translation/types";

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

  const sourceChanged = existing[sourceLocale] !== sourceText;
  const targetEmpty = !existing[targetLocale];

  if (!sourceText) {
    return result;
  }

  if (targetEmpty || sourceChanged) {
    result[targetLocale] = await provider.translate(sourceText, sourceLocale, targetLocale);
  }

  return result;
}
