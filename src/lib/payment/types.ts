import type { CreatePaymentResult, VerifyPaymentResult } from "@/lib/subscription/types";
import type { PaymentPurpose } from "@/lib/payment/canonical-types";

export type CreatePaymentInput = {
  providerId: string;
  /** Required for legacy subscription upgrades; null for unlock/business. */
  subscriptionId?: string | null;
  amount: number;
  currency: string;
  reference: string;
  purpose?: PaymentPurpose;
  unlockSessionId?: string | null;
  idempotencyKey?: string | null;
};

export type VerifyPaymentInput = {
  paymentId: string;
  externalTransactionId?: string;
};

/**
 * Payment Provider port — Stripe/manual/etc implement this.
 * Business logic must never import Stripe SDK.
 */
export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  cancelPayment(paymentId: string): Promise<void>;
  /** Future: real refunds. Must not silently rewrite paid → failed. */
  refund(
    paymentId: string,
    options?: { amount?: number; currency?: string; reason?: string },
  ): Promise<
    | { ok: true; stripeRefundId?: string }
    | { ok: false; error: string }
  >;
}
