import { defaultLocale, isValidLocale, type Locale } from "@/lib/i18n/config";

/**
 * Allow only same-origin relative paths for post-login / auth redirects.
 * Blocks open redirects (//evil, https://..., javascript:, etc.).
 */
export function sanitizeAppRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("://") || value.includes("\\")) return null;
  if (/[\s<>"']/.test(value)) return null;
  return value;
}

/** Strip locale prefix so role routing can compare clean paths. */
export function stripLocaleFromPath(pathname: string): string {
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const stripped = pathname.slice(3);
    return stripped.length > 0 ? stripped : "/";
  }
  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    const stripped = pathname.slice(3);
    return stripped.length > 0 ? stripped : "/";
  }
  return pathname;
}

export function localeFromPathname(pathname: string): Locale {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/ar" || pathname.startsWith("/ar/")) return "ar";
  return defaultLocale;
}

export function withLocalePrefix(path: string, locale: Locale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  if (clean === "/") return `/${locale}`;
  return `/${locale}${clean}`;
}

export function getAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function buildAuthCallbackUrl(nextPath: string, locale?: Locale): string {
  const safeNext = sanitizeAppRedirect(nextPath) ?? "/";
  const loc = locale && isValidLocale(locale) ? locale : defaultLocale;
  const localized = withLocalePrefix(stripLocaleFromPath(safeNext), loc);
  const url = new URL("/auth/callback", getAppOrigin());
  url.searchParams.set("next", localized);
  return url.toString();
}
