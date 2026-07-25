import type { CreatePaymentResult, VerifyPaymentResult } from "@/lib/subscription/types";

export type CreatePaymentInput = {
  providerId: string;
  /** Required for subscription upgrades; null for unlock_fee. */
  subscriptionId?: string | null;
  amount: number;
  currency: string;
  reference: string;
  purpose?: "subscription" | "unlock_fee";
  unlockSessionId?: string | null;
  idempotencyKey?: string | null;
};

export type VerifyPaymentInput = {
  paymentId: string;
  externalTransactionId?: string;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  cancelPayment(paymentId: string): Promise<void>;
  refund(paymentId: string): Promise<void>;
}
