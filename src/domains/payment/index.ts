/**
 * SAD Payment domain — unlock fees, subscriptions, wallet, escrow, payouts.
 * Sprint 6 + Sprint 10 Phase 4 Enterprise Payment & Wallet Platform.
 */

export const PAYMENT_DOMAIN = {
  service: "payment",
  owns: [
    "payments.purpose",
    "payments.unlock_session_id",
    "payment_webhook_events",
    "payment_status_snapshots",
    "lead_unlock_payments",
    "business_subscription_payments",
    "unlock_fee_capture",
    "wallets",
    "wallet_ledger",
    "escrow_holds",
    "payouts",
    "payment_fee_rules",
    "marketplace_payment_disputes",
  ],
  impl: [
    "src/domains/payment",
    "src/lib/payment",
    "src/lib/refunds",
    "src/lib/financial-documents",
  ],
  status: "active",
  sprint: 10,
  featureFlag: "PAYMENTS_V2",
  flags: ["PAYMENTS_V2", "PAYMENT_WALLET", "ESCROW_ENGINE", "PAYOUTS_V1"],
} as const;

export type {
  CreatePaymentInput,
  VerifyPaymentInput,
  PaymentProvider,
} from "@/lib/payment/types";
export type {
  PaymentPurpose,
  PaymentLifecycleStatus,
  CanonicalPaymentEventType,
  PaymentRecord,
} from "@/lib/payment/canonical-types";

export type {
  WalletBalances,
  WalletLedgerEntry,
  EscrowHoldView,
  FeeBreakdown,
  PayoutView,
  PaymentAdapterId,
} from "@/domains/payment/shared/types";

export {
  createUnlockFeePayment,
  getActiveUnlockFeePayment,
  cancelUnlockFeePayment,
  markUnlockFeePaymentFailed,
  type UnlockFeePaymentView,
} from "@/domains/payment/unlock-fee";

export {
  captureUnlockFeePayment,
  rejectUnlockFeePayment,
  type CaptureSource,
} from "@/domains/payment/capture";

export { ingestPaymentWebhook } from "@/domains/payment/webhook";
export { recordVerifiedPaymentEvent } from "@/domains/payment/webhook-ledger";

export {
  createPaymentIntent,
  listProviderPayments,
  getPaymentById,
  transitionPaymentStatus,
} from "@/lib/payment/orchestration";

export {
  startBusinessSubscriptionPayment,
  activateBusinessSubscriptionFromPayment,
  getActiveBusinessSubscriptionPayment,
} from "@/lib/payment/business-subscription";

export {
  recordLeadUnlockPayment,
  markLeadUnlockGranted,
} from "@/lib/payment/lead-payments";

/* Sprint 10 Phase 4 — enterprise engines */
export {
  getOrCreateWallet,
  listWalletLedger,
  applyWalletLedgerEntry,
} from "@/domains/payment/wallet/service";

export { calculateFeeBreakdown } from "@/domains/payment/fees/engine";

export {
  createEscrowHold,
  releaseEscrow,
  refundEscrow,
  holdEscrowForDispute,
  cancelEscrow,
  getEscrowById,
  listEscrows,
} from "@/domains/payment/escrow/engine";

export {
  createPayout,
  processPayout,
  retryPayout,
  listPayouts,
  getPayoutById,
} from "@/domains/payment/payouts/engine";

export {
  initializePayment,
  authorizePayment,
  capturePayment,
  reserveInEscrow,
  releaseEscrowFunds,
  refundPayment,
  cancelPaymentEngine,
  retryFailedPayment,
} from "@/domains/payment/engine/payment-engine";

export {
  getPaymentStatus,
  listUserPaymentHistory,
} from "@/domains/payment/transactions/service";

export { resolveAdapter, listRegisteredAdapters } from "@/domains/payment/providers/registry";

export { emitPaymentTimelineEvent } from "@/domains/payment/shared/timeline";

export {
  canAccessPayment,
  canAccessEscrow,
  canAccessRefund,
  assertEscrowActorAllowed,
} from "@/domains/payment/authz";

export { logFinancialAudit } from "@/domains/payment/audit";
export type { FinancialAuditAction } from "@/domains/payment/audit";
