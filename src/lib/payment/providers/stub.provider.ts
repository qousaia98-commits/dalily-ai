/**
 * Stub adapter for future / regional PSPs — records intents via manual rail.
 * Prevents business logic from coupling to a specific provider.
 */

import { ManualPaymentProvider } from "@/lib/payment/providers/manual.provider";
import type {
  CreatePaymentInput,
  PaymentProvider,
  VerifyPaymentInput,
} from "@/lib/payment/types";
import type { CreatePaymentResult, VerifyPaymentResult } from "@/lib/subscription/types";

export class StubPaymentProvider implements PaymentProvider {
  readonly name: string;
  private readonly fallback = new ManualPaymentProvider();

  constructor(name: string) {
    this.name = name;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Future PSP wiring goes here; beta falls back to manual instructions.
    return this.fallback.createPayment({
      ...input,
      // keep purpose; manual provider stores payment_provider as "manual"
    });
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return this.fallback.verifyPayment(input);
  }

  async cancelPayment(paymentId: string): Promise<void> {
    return this.fallback.cancelPayment(paymentId);
  }

  async refund(
    paymentId: string,
    options?: { amount?: number; currency?: string; reason?: string },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    void paymentId;
    void options;
    return { ok: false, error: `${this.name}_refund_not_configured` };
  }
}
