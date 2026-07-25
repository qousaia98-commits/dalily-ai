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
 */
export function isMarketplaceDomainV2Enabled(): boolean {
  return envFlag("MARKETPLACE_DOMAIN_V2");
}

/**
 * Sprint 2 — Customer intent flow (intake → publish → waiting room).
 */
export function isCustomerIntentFlowV2Enabled(): boolean {
  return envFlag("CUSTOMER_INTENT_FLOW_V2");
}

/**
 * Sprint 3 — Matching engine (scarce pool + reason codes).
 * When false: publish does not create match_assignments.
 * Never reads subscription tier for eligibility/rank.
 */
export function isMatchingV2Enabled(): boolean {
  return envFlag("MATCHING_V2");
}

/**
 * Sprint 4 — Competing offers + customer select (no PII / chat release).
 * When false: legacy quotes path unchanged.
 * Offers must originate from match_assignments.
 */
export function isOffersV2Enabled(): boolean {
  return envFlag("OFFERS_V2");
}

/**
 * Sprint 5 — Unlock sessions, SLA, contact-release grants.
 * When false: selection stays pending_unlock with no session/grant.
 * Grant without a payment event only when UNLOCK_DEV_BYPASS is on (never for prod).
 */
export function isUnlockV2Enabled(): boolean {
  return envFlag("UNLOCK_V2");
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

/**
 * Sprint 6 — Unlock fee payment capture correlated to grants.
 * When false: Sprint 5 unlock surfaces stay (bypass/admin manual only).
 * When true: unlock grant requires verified server-side payment success
 * (admin approval rail or webhook), except UNLOCK_DEV_BYPASS.
 * Also freezes new subscription upgrade checkout.
 */
export function isUnlockPaymentsV2Enabled(): boolean {
  return envFlag("UNLOCK_PAYMENTS_V2");
}
