import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";
import { safeLocalizedText } from "@/lib/translation/guard";

export function localizedField(value: LocalizedJson | null | undefined, locale: Locale): string {
  return safeLocalizedText(value, locale);
}
