/**
 * Guards against LLM meta-responses leaking into marketplace UI / DB.
 * Translation models sometimes return apology / prompt text instead of a translation.
 */

const LEAK_PATTERNS: RegExp[] = [
  /i'?m sorry.*translat/i,
  /need text to translate/i,
  /please provide.*(arabic|english|text|content|translation)/i,
  /provide the arabic content/i,
  /as an ai\b/i,
  /i (can'?t|cannot|do not|don't) translate/i,
  /no (text|content|string) (was )?(provided|given|found)/i,
  /unable to translate/i,
  /translation (is )?unavailable/i,
  /return only the translated text/i,
  /you translate business content/i,
];

/** True when text looks like an assistant/system reply, not user marketplace content. */
export function looksLikeTranslationFailure(text: string | null | undefined): boolean {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return false;
  return LEAK_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Prefer locale, fall back to the other language.
 * Never return AI meta / prompt leakage.
 */
export function safeLocalizedText(
  value: { ar?: string | null; en?: string | null } | null | undefined,
  locale: string,
): string {
  if (!value) return "";
  const primary = locale === "en" ? value.en : value.ar;
  const fallback = locale === "en" ? value.ar : value.en;
  const primaryTrim = (primary ?? "").trim();
  const fallbackTrim = (fallback ?? "").trim();

  if (primaryTrim && !looksLikeTranslationFailure(primaryTrim)) return primaryTrim;
  if (fallbackTrim && !looksLikeTranslationFailure(fallbackTrim)) return fallbackTrim;
  return "";
}

/** Strip leaky translation for a single string field (offer message, etc.). */
export function safeMarketplaceCopy(text: string | null | undefined): string | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;
  if (looksLikeTranslationFailure(trimmed)) return null;
  return trimmed;
}
