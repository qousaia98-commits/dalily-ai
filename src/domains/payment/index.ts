/**
 * SAD Payment domain — unlock fees + Business subscriptions (Sprint 6).
 * Legacy PRO subscription payments remain in subscription.service.
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
  ],
  impl: ["src/domains/payment", "src/lib/payment"],
  status: "active",
  sprint: 6,
  featureFlag: "UNLOCK_PAYMENTS_V2",
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
