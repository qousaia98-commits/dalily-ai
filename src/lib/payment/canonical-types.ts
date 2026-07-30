/**
 * Sprint 6 Phase 2 — canonical payment types (provider-agnostic).
 * Business modules import from here — never from Stripe/manual SDK.
 */

export type PaymentPurpose =
  | "subscription"
  | "business_subscription"
  | "unlock_fee"
  | "lead_unlock"
  | "refund"
  | "credit"
  | "wallet"
  | "invoice"
  | "escrow"
  | "payout"
  | "marketplace_job"
  | "fee";

export type PaymentLifecycleStatus =
  | "pending"
  | "pending_review"
  | "authorized"
  | "captured"
  | "reserved"
  | "released"
  | "paid"
  | "refunded"
  | "partially_refunded"
  | "failed"
  | "cancelled"
  | "rejected"
  | "expired"
  | "disputed";

/** Events reported BY payment providers — no business logic. */
export type CanonicalPaymentEventType =
  | "payment_succeeded"
  | "payment_failed"
  | "payment_cancelled"
  | "payment_expired"
  | "payment_authorized"
  | "payment_captured"
  | "payment_released"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "refund_succeeded"
  | "refund_failed"
  | "payout_succeeded"
  | "payout_failed"
  | "dispute_opened"
  | "dispute_resolved";

export type PaymentRecord = {
  id: string;
  providerId: string;
  purpose: PaymentPurpose;
  amount: number;
  currency: string;
  status: PaymentLifecycleStatus;
  paymentProvider: string;
  reference: string;
  providerReference: string | null;
  unlockSessionId: string | null;
  subscriptionId: string | null;
  createdAt: string;
  paidAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  receiptPath: string | null;
  hasReceipt: boolean;
  /** Cumulative refunded amount; payment status stays paid. */
  refundedAmount: number;
  refundStatus: "none" | "partial" | "full" | "pending" | null;
};

export type CreatePaymentIntentInput = {
  providerId: string;
  purpose: PaymentPurpose;
  amount: number;
  currency: string;
  subscriptionId?: string | null;
  unlockSessionId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type PaymentIntentResult = {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  instructions?: {
    receiver: string;
    account: string;
    swift?: string;
    bankName?: string;
  };
  clientSecret?: string;
  checkoutUrl?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  publishableKey?: string;
  reused: boolean;
};
