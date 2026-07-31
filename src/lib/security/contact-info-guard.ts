/**
 * Pre-unlock contact-info guard.
 * Rejects phone numbers / emails on marketplace surfaces that are visible
 * before a contact_release_grant exists (intent, offer message, clarifications).
 *
 * Patterns adapted from src/lib/ai/privacy/scrub.ts — phone matching is tightened
 * to avoid false positives on prices, quantities, and street/apartment numbers.
 */

/** Same shape as AI scrub email matcher (ASCII local-part + domain). */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Syrian mobile (local): 09XXXXXXXX with optional separators between digits.
 * Examples: 0912345678, 0912 345 678, 09-12-345-678
 */
const SYRIAN_LOCAL_MOBILE_RE =
  /(?<![0-9])09(?:[\s./\-]*[0-9]){8}(?![0-9])/;

/**
 * Syrian mobile (international): +963 / 00963 / 963 + 9XXXXXXXX
 * Examples: +963912345678, +963 9 123 456 78, 00963912345678
 */
const SYRIAN_INTL_MOBILE_RE =
  /(?:\+|00)?963[\s./\-]*9(?:[\s./\-]*[0-9]){8}(?![0-9])/;

/** Error code returned by domain write paths; map via next-intl `errors.*`. */
export const CONTACT_INFO_BLOCKED_ERROR = "contact_info_blocked" as const;

export type ContactInfoKind = "email" | "phone";

/** Arabic-Indic (U+0660–0669) and Eastern Arabic-Indic / Persian (U+06F0–06F9) → ASCII. */
export function normalizeIndicDigits(text: string): string {
  return text
    .replace(/[\u0660-\u0669]/g, (d) =>
      String(d.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (d) =>
      String(d.charCodeAt(0) - 0x06f0),
    );
}

export function detectContactInfo(text: string): ContactInfoKind | null {
  if (!text) return null;
  if (EMAIL_RE.test(text)) return "email";

  const normalized = normalizeIndicDigits(text);
  if (
    SYRIAN_LOCAL_MOBILE_RE.test(normalized) ||
    SYRIAN_INTL_MOBILE_RE.test(normalized)
  ) {
    return "phone";
  }
  return null;
}

export function containsContactInfo(text: string): boolean {
  return detectContactInfo(text) !== null;
}
