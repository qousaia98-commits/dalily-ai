/**
 * Payments & monetization feature flags.
 */

import { envFlag } from "./core";

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

/**
 * Sprint 6 Phase 1 — Provider Monetization:
 * FREE (AI pay-per-lead) vs BUSINESS ($20/mo, 10 included unlocks).
 */
export function isProviderMonetizationEnabled(): boolean {
  return (
    envFlag("PROVIDER_MONETIZATION") ||
    envFlag("PROVIDER_MONETIZATION_V1") ||
    envFlag("LEAD_MONETIZATION_V1")
  );
}

/**
 * Sprint 6 Phase 2 — Subscription & lead payment infrastructure
 * (history, status snapshots, canonical webhook events).
 * Defaults on when UNLOCK_PAYMENTS_V2 or PROVIDER_MONETIZATION is on.
 */
export function isPaymentInfrastructureEnabled(): boolean {
  return (
    envFlag("PAYMENT_INFRASTRUCTURE") ||
    envFlag("PAYMENT_INFRASTRUCTURE_V1") ||
    isUnlockPaymentsV2Enabled() ||
    isProviderMonetizationEnabled()
  );
}

/** Sprint 6 Phase 3 — Stripe live when provider=stripe and secret key set. */
export function isStripePaymentsEnabled(): boolean {
  return (
    (process.env.PAYMENT_PROVIDER ?? "manual").toLowerCase() === "stripe" &&
    Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  );
}

/** Sprint 6 Phase 4 — automatic invoices/receipts PDF generation. */
export function isFinancialDocumentsEnabled(): boolean {
  return (
    envFlag("FINANCIAL_DOCUMENTS") ||
    envFlag("FINANCIAL_DOCUMENTS_V1") ||
    isPaymentInfrastructureEnabled()
  );
}

/**
 * Sprint 6 Phase 5 — Refunds & disputes (admin approval + Stripe + credit notes).
 * Defaults on when payment infrastructure is enabled.
 */
export function isRefundsDisputesEnabled(): boolean {
  return (
    envFlag("REFUNDS_DISPUTES") ||
    envFlag("REFUNDS_DISPUTES_V1") ||
    isPaymentInfrastructureEnabled()
  );
}

/**
 * Sprint 6 Phase 6 — Finance dashboard & revenue analytics (read-only).
 * Defaults on when payment infrastructure is enabled.
 */
export function isFinanceDashboardEnabled(): boolean {
  return (
    envFlag("FINANCE_DASHBOARD") ||
    envFlag("FINANCE_DASHBOARD_V1") ||
    isPaymentInfrastructureEnabled()
  );
}
