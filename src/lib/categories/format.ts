import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";

export function localizedField(value: LocalizedJson | null | undefined, locale: Locale): string {
  if (!value) return "";
  return locale === "ar" ? value.ar : value.en;
}
