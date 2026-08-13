/**
 * Runtime configuration helpers (Sprint 9.5 Phase 6).
 * Thin, non-secret environment reads — no behaviour change vs prior ad-hoc checks.
 */

export function resolveDalilyEnv(): string {
  return (
    process.env.DALILY_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    "development"
  );
}

export function isProductionRuntime(): boolean {
  if (process.env.DALILY_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  return (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview"
  );
}

export function resolveAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}
