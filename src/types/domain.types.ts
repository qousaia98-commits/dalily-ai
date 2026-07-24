import type { Locale } from "@/lib/i18n/config";

export type LocalizedText = Record<Locale, string>;

export function getLocalizedText(
  text: LocalizedText | { ar?: string; en?: string } | null | undefined,
  locale: Locale,
): string {
  if (!text) return "";
  const primary = (locale === "en" ? text.en : text.ar)?.trim() ?? "";
  if (primary) return primary;
  const fallback = (locale === "en" ? text.ar : text.en)?.trim() ?? "";
  return fallback;
}
