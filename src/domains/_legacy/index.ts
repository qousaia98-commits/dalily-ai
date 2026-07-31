/**
 * Pointers to LEGACY modules. See docs/migration/legacy-inventory.md
 */

export const LEGACY_MODULES = [
  "src/lib/subscription",
  "src/lib/search",
  "src/lib/search/smart-match",
  "src/lib/dalily-ranking",
  "src/lib/smart-map",
  "src/lib/service-requests",
  "src/lib/booking",
  "src/app/[locale]/(public)/search",
  "src/app/[locale]/(public)/providers",
  "src/components/search",
] as const;

export const LEGACY_DOMAIN = {
  service: "_legacy",
  status: "inventory",
  modules: LEGACY_MODULES,
} as const;
