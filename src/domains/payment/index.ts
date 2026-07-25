/**
 * SAD Payment domain — unlock fee capture (Sprint 6).
 * Legacy subscription payments remain in src/lib/payment + subscription.service.
 */

export const PAYMENT_DOMAIN = {
  service: "payment",
  owns: [
    "payments.purpose",
    "payments.unlock_session_id",
    "payment_webhook_events",
    "unlock_fee_capture",
  ],
  impl: ["src/domains/payment", "src/lib/payment"],
  status: "active",
  sprint: 6,
  featureFlag: "UNLOCK_PAYMENTS_V2",
} as const;

export type { CreatePaymentInput, VerifyPaymentInput, PaymentProvider } from "@/lib/payment/types";

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
