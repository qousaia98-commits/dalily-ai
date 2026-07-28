/**
 * Feature-flag core helpers (Sprint 9.5 Phase 6).
 * One shared env reader — no runtime behaviour change.
 */

export function envFlag(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on";
}

/**
 * Dev-only: allow unlock success/grant without payment event.
 * Must remain off in production configuration.
 */
export function isUnlockDevBypassEnabled(): boolean {
  // Never allow grant-without-payment in any production config.
  if (process.env.DALILY_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview"
  ) {
    return false;
  }
  return envFlag("UNLOCK_DEV_BYPASS");
}
