import type { CreatePaymentResult, VerifyPaymentResult } from "@/lib/subscription/types";

export type CreatePaymentInput = {
  providerId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  reference: string;
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
