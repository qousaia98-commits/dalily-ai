/**
 * Centralized date/time formatting.
 *
 * Every call always pins an explicit locale and time zone, so server-rendered
 * HTML and the client's post-hydration render produce byte-identical output.
 * `Date.prototype.toLocaleString()` (and its `*DateString`/`*TimeString`
 * siblings) fall back to the *runtime's* ambient locale/time zone when either
 * is omitted — which differs between the Node server and a visitor's browser
 * and is a classic source of React hydration mismatches. Formatting must
 * always go through these helpers instead of calling `toLocaleString` et al.
 * directly.
 */

const DEFAULT_LOCALE = "en-US";
const TIME_ZONE = "Asia/Damascus";

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleString(locale, { timeZone: TIME_ZONE, ...options });
}

export function formatDate(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleDateString(locale, { timeZone: TIME_ZONE, ...options });
}

export function formatTime(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleTimeString(locale, { timeZone: TIME_ZONE, ...options });
}
