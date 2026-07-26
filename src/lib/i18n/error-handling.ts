import { IntlError, IntlErrorCode } from "next-intl";

/**
 * Clear console diagnostics for missing / insufficient translation paths in development.
 * Production keeps next-intl defaults (no noisy console spam to end users).
 */
export function onI18nError(error: IntlError) {
  if (process.env.NODE_ENV !== "development") return;

  const path = error.originalMessage ?? error.message;
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    console.error(
      [
        "--------------------------------",
        "Missing translation:",
        `  ${path}`,
        "Expected:",
        "  string",
        "Found:",
        "  undefined",
        "--------------------------------",
      ].join("\n"),
    );
    return;
  }

  if (error.code === IntlErrorCode.INSUFFICIENT_PATH) {
    console.error(
      [
        "--------------------------------",
        "Translation path:",
        `  ${path}`,
        "Expected:",
        "  string",
        "Found:",
        "  object",
        "Use a deeper leaf key that resolves to a string.",
        "--------------------------------",
      ].join("\n"),
    );
    return;
  }

  console.error(`[i18n] ${error.code}: ${error.message}`);
}

export function getI18nMessageFallback({
  namespace,
  key,
  error,
}: {
  namespace?: string;
  key: string;
  error: IntlError;
}) {
  const path = [namespace, key].filter(Boolean).join(".");
  if (process.env.NODE_ENV === "development") {
    return `⚠ ${error.code}: ${path}`;
  }
  return path;
}
