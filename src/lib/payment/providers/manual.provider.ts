import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentConfig } from "@/lib/payment/config";
import type { CreatePaymentInput, PaymentProvider, VerifyPaymentInput } from "@/lib/payment/types";
import type { CreatePaymentResult, VerifyPaymentResult } from "@/lib/subscription/types";

/**
 * Beta payment provider — creates pending payments with a stored unique reference.
 * Admin approval after receipt review activates the subscription.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const admin = createAdminClient();
    const config = getPaymentConfig();

    const { data, error } = await admin
      .from("payments")
      .insert({
        provider_id: input.providerId,
        subscription_id: input.subscriptionId,
        payment_provider: "manual",
        payment_status: "pending",
        amount: input.amount,
        currency: input.currency,
        payment_reference: input.reference,
      })
      .select("id, payment_reference")
      .single();

    if (error || !data) {
      throw new Error("payment_create_failed");
    }

    return {
      paymentId: data.id,
      instructions: {
        receiver: config.receiver,
        account: config.account,
        swift: config.swift || undefined,
        bankName: config.bankName || undefined,
        amount: input.amount,
        currency: input.currency,
        reference: data.payment_reference,
      },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("id, payment_status")
      .eq("id", input.paymentId)
      .maybeSingle();

    if (
      !payment ||
      (payment.payment_status !== "pending" && payment.payment_status !== "pending_review")
    ) {
      return { success: false, paymentId: input.paymentId };
    }

    return {
      success: true,
      paymentId: payment.id,
      externalTransactionId: input.externalTransactionId,
    };
  }

  async cancelPayment(paymentId: string): Promise<void> {
    const admin = createAdminClient();
    await admin.from("payments").update({ payment_status: "cancelled" }).eq("id", paymentId);
  }

  async refund(paymentId: string): Promise<void> {
    const admin = createAdminClient();
    await admin
      .from("payments")
      .update({ payment_status: "failed" })
      .eq("id", paymentId)
      .eq("payment_status", "paid");
  }
}
