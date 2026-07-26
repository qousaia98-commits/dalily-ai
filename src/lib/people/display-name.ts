/**
 * Resolve a human display name for customers / peers.
 * Never surface English placeholders like "Customer" in Arabic UI —
 * callers pass a localized fallback (e.g. "عميل").
 */

const PLACEHOLDER_NAMES = new Set([
  "customer",
  "business",
  "user",
  "unknown",
  "n/a",
  "na",
  "-",
  "—",
]);

function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_NAMES.has(value.toLowerCase());
}

export type PersonNameFields = {
  display_name?: string | null;
  displayName?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  first_name?: string | null;
  firstName?: string | null;
};

/**
 * Fallback order: display_name → full_name → first_name → localized fallback.
 */
export function resolvePersonDisplayName(
  profile: PersonNameFields | string | null | undefined,
  localizedFallback: string,
): string {
  if (typeof profile === "string") {
    const s = clean(profile);
    if (s && !isPlaceholder(s)) return s;
    return localizedFallback;
  }

  const candidates = [
    profile?.display_name,
    profile?.displayName,
    profile?.full_name,
    profile?.fullName,
    profile?.first_name,
    profile?.firstName,
  ];

  for (const candidate of candidates) {
    const s = clean(candidate);
    if (s && !isPlaceholder(s)) return s;
  }

  return localizedFallback;
}

/** Locale-aware customer fallback label. */
export function customerFallbackLabel(locale: string): string {
  return locale === "ar" ? "عميل" : "Customer";
}

/** Locale-aware business fallback label. */
export function businessFallbackLabel(locale: string): string {
  return locale === "ar" ? "عمل" : "Business";
}

/**
 * Resolve provider business name from localized JSON or string.
 * Prefers the active locale, then the other locale, then localized fallback.
 */
export function resolveProviderBusinessName(
  name: unknown,
  locale: string,
): string {
  const fallback = businessFallbackLabel(locale);
  if (typeof name === "string") {
    return resolvePersonDisplayName(name, fallback);
  }
  if (typeof name === "object" && name !== null) {
    const obj = name as { ar?: string | null; en?: string | null };
    const preferred = locale === "ar" ? obj.ar : obj.en;
    const secondary = locale === "ar" ? obj.en : obj.ar;
    return resolvePersonDisplayName(
      { display_name: preferred, full_name: secondary },
      fallback,
    );
  }
  return fallback;
}
