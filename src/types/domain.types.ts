import type { Locale } from "@/lib/i18n/config";

export type LocalizedText = Record<Locale, string>;

export function getLocalizedText(text: LocalizedText, locale: Locale): string {
  return text[locale];
}
