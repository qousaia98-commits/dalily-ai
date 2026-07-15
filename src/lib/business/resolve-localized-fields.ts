import { getTranslationService } from "@/lib/translation";
import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";

/**
 * Resolves a localized JSONB field from a single UI language.
 * Never throws on translation failures — source text is always stored.
 */
export async function resolveLocalizedField(
  sourceLocale: Locale,
  sourceText: string,
  existing: LocalizedJson = { ar: "", en: "" },
): Promise<LocalizedJson> {
  try {
    return await getTranslationService().syncField({
      sourceLocale,
      sourceText,
      existing,
    });
  } catch (error) {
    console.error("[translation] resolveLocalizedField unexpected failure", {
      sourceLocale,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      ar: existing.ar ?? "",
      en: existing.en ?? "",
      [sourceLocale]: sourceText.trim(),
    };
  }
}
