/**
 * Language + dialect detection for voice transcripts.
 */

import type { VoiceDialectCode, VoiceLanguageCode, VoiceLanguageDetection } from "./types";

const SYRIAN_CUES =
  /شو|هلأ|هلق|بديش|بدك|عم\s|منيح|مبينا|شلون|وين|هون|هيك|كتير|يعني/;
const LEBANESE_CUES = /كيفك|يلا|ولك|بعدين|مش\s+عارف|هيدا|هلأ/;
const LEVANTINE_CUES = /بدي|هون|هيك|منيح|كتير/;
const MSA_CUES = /الرجاء|يرجى|أحتاج|أحتاج إلى|المشكلة هي/;
const GERMAN_CUES =
  /\b(und|der|die|das|ich|nicht|wasser|hahn|undicht|kaputt|bitte)\b/i;
const ENGLISH_CUES =
  /\b(the|is|my|faucet|leaking|broken|please|need|water|pipe)\b/i;

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function hasLatin(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

function mapWhisperLanguage(code: string | null | undefined): VoiceLanguageCode | null {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c === "ar" || c.startsWith("ar-")) return "ar";
  if (c === "en" || c.startsWith("en-")) return "en";
  if (c === "de" || c.startsWith("de-")) return "de";
  return null;
}

export function detectVoiceLanguage(input: {
  transcript: string;
  whisperLanguage?: string | null;
}): VoiceLanguageDetection {
  const text = input.transcript.trim();
  const whisperMapped = mapWhisperLanguage(input.whisperLanguage);

  const arabic = hasArabic(text);
  const latin = hasLatin(text);
  const germanHits = GERMAN_CUES.test(text);
  const englishHits = ENGLISH_CUES.test(text);

  let language: VoiceLanguageCode = "und";
  let confidence = 0.4;

  if (arabic && latin) {
    language = "mixed";
    confidence = 0.75;
  } else if (arabic) {
    language = "ar";
    confidence = 0.85;
  } else if (germanHits && !englishHits) {
    language = "de";
    confidence = 0.7;
  } else if (latin) {
    language = whisperMapped === "de" ? "de" : "en";
    confidence = whisperMapped ? 0.8 : 0.65;
  }

  if (whisperMapped) {
    if (language === "und" || language === whisperMapped) {
      language = whisperMapped;
      confidence = Math.max(confidence, 0.82);
    } else if (language === "mixed") {
      confidence = Math.max(confidence, 0.78);
    } else if (language !== whisperMapped) {
      // Prefer script evidence; slight confidence drop
      confidence = Math.min(confidence, 0.7);
    }
  }

  const dialect = detectVoiceDialect(text, language);

  return {
    language,
    dialect,
    confidence,
    whisperLanguage: input.whisperLanguage ?? null,
  };
}

export function detectVoiceDialect(
  text: string,
  language: VoiceLanguageCode,
): VoiceDialectCode {
  if (language === "de") return "de";
  if (language === "en") {
    if (/\b(colour|favourite|lorry|flat)\b/i.test(text)) return "en_gb";
    return "en_us";
  }
  if (language === "mixed") return "mixed";
  if (language !== "ar") return "unknown";

  if (LEBANESE_CUES.test(text) && !SYRIAN_CUES.test(text)) return "lebanese";
  if (SYRIAN_CUES.test(text)) return "syrian";
  if (LEVANTINE_CUES.test(text)) return "levantine";
  if (MSA_CUES.test(text)) return "msa";
  // Default Levantine Arabic for Syria product surface
  return "levantine";
}
