/** Shared AI Engine constants & primitives (Phase 1). */

export type AiLanguage = "ar" | "en" | "mixed" | "und";

export type AiDialect =
  | "syrian"
  | "levantine"
  | "msa"
  | "en_us"
  | "en_gb"
  | "unknown";

export type AiResolveSource =
  | "knowledge"
  | "rules"
  | "llm"
  | "user"
  | "hybrid"
  | "unknown";

/** Skip LLM when knowledge confidence >= this. */
export const AI_KNOWLEDGE_HIT_THRESHOLD = 0.72;

/** Persist a new/updated knowledge phrase when detection confidence >= this. */
export const AI_KNOWLEDGE_STORE_THRESHOLD = 0.45;

/** Truncate stored phrase text (privacy + size). */
export const AI_MAX_TEXT_CHARS = 500;

/** Confidence bump on user confirmation. */
export const AI_CONFIRM_DELTA = 0.06;

/** Confidence drop on user correction. */
export const AI_CORRECT_DELTA = 0.12;

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
