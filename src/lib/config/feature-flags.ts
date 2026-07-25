/**
 * Feature flags for Dalily 2.0 strangler migration.
 * Defaults are OFF so production behavior stays legacy until explicitly enabled.
 */

function envFlag(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on";
}

/**
 * Sprint 1 — Marketplace domain read-model / projections.
 * When false: identical legacy behavior (no marketplace metadata attached).
 * When true: reads enrich via Marketplace anti-corruption layer; writes still legacy.
 */
export function isMarketplaceDomainV2Enabled(): boolean {
  return envFlag("MARKETPLACE_DOMAIN_V2");
}
