import { getTranslationService } from "@/lib/translation";
import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";

export async function resolveLocalizedField(
  sourceLocale: Locale,
  sourceText: string,
  existing: LocalizedJson = { ar: "", en: "" },
): Promise<LocalizedJson> {
  return getTranslationService().syncField({
    sourceLocale,
    sourceText,
    existing,
  });
}
