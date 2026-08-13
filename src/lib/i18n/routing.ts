/**
 * Locale routing config only — safe for middleware / Edge.
 * Do NOT export createNavigation / Link from this file.
 * @see https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing
 */
import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  // Explicit switcher + cookie win over Accept-Language (Playwright/browsers).
  localeDetection: false,
});
