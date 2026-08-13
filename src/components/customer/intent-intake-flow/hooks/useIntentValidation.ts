"use client";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

/**
 * Pure-ish validation helpers for the intent intake flow.
 * Owns resolveError + intent length / city required checks.
 */
export function useIntentValidation(t: TranslateFn) {
  function resolveError(code?: string) {
    if (!code) return t("errors.unknown");
    try {
      return t(`errors.${code}` as "errors.unknown");
    } catch {
      return t("errors.unknown");
    }
  }

  function isIntentTooShort(text: string) {
    return text.trim().length < 8;
  }

  function isCityRequired(cityId: string) {
    return !cityId;
  }

  return { resolveError, isIntentTooShort, isCityRequired };
}
