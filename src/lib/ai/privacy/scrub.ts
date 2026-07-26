import { normalizeSearchText } from "@/lib/search/engine/normalize";
import type { AiDialect, AiLanguage } from "@/lib/ai/types";
import { AI_MAX_TEXT_CHARS } from "@/lib/ai/types";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g;
/** Rough lat/lng pairs */
const GPS_RE = /-?\d{1,3}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/g;

/**
 * Strip PII-ish tokens before AI persistence (GDPR-minded).
 * Does not claim perfect scrubbing — prefer not storing raw chat bodies here.
 */
export function scrubAiText(input: string): string {
  const scrubbed = input
    .replace(EMAIL_RE, "[email]")
    .replace(GPS_RE, "[coords]")
    .replace(PHONE_RE, "[phone]")
    .replace(/\s+/g, " ")
    .trim();
  if (scrubbed.length <= AI_MAX_TEXT_CHARS) return scrubbed;
  return `${scrubbed.slice(0, AI_MAX_TEXT_CHARS - 1)}…`;
}

export function normalizeAiPhrase(input: string): string {
  return normalizeSearchText(scrubAiText(input));
}

/** Lightweight language hint — not a full detector. */
export function detectLanguageHint(text: string): AiLanguage {
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasArabic && hasLatin) return "mixed";
  if (hasArabic) return "ar";
  if (hasLatin) return "en";
  return "und";
}

export function detectDialectHint(text: string, language: AiLanguage): AiDialect {
  if (language === "en") return "en_us";
  if (language === "ar" || language === "mixed") {
    // Very light Syrian/Levantine cues — expandable later.
    if (/شو|بد|هلأ|هلق|بديش|بدك|يعني/.test(text)) return "syrian";
    if (/بدي|هون|هيك/.test(text)) return "levantine";
    return "msa";
  }
  return "unknown";
}
