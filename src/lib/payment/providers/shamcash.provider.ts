/**
 * Cham Cash (apisyria.com) payment provider — Syria e-wallet rail.
 * Creates pending payments like the manual rail, but verification can be
 * automated: the provider pastes their Cham Cash transaction id and we
 * confirm it via shamcash-client instead of waiting on an admin.
 *
 * Falls back to manual admin review whenever the API can't confirm a
 * transaction (not integrated yet, network error, or a genuine mismatch) —
 * it never blocks a payment from also going through the receipt-upload path.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getChamCashAccountAddress } from "@/lib/payment/config";
import { verifyChamCashTransaction } from "@/lib/payment/providers/shamcash-client";
import type { CreatePaymentInput, PaymentProvider, VerifyPaymentInput } from "@/lib/payment/types";
import type { CreatePaymentResult, VerifyPaymentResult } from "@/lib/subscription/types";

export class ShamCashPaymentProvider implements PaymentProvider {
  readonly name = "shamcash";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const admin = createAdminClient();
    const account = getChamCashAccountAddress();

    const { data, error } = await admin
      .from("payments")
      .insert({
        provider_id: input.providerId,
        subscription_id: input.subscriptionId ?? null,
        payment_provider: "shamcash",
        payment_status: "pending",
        amount: input.amount,
        currency: input.currency,
        payment_reference: input.reference,
        purpose: (input.purpose ?? "subscription") as never,
        unlock_session_id: input.unlockSessionId ?? null,
        idempotency_key: input.idempotencyKey ?? null,
      } as never)
      .select("id, payment_reference")
      .single();

    if (error || !data) {
      throw new Error("payment_create_failed");
    }

    return {
      paymentId: data.id,
      instructions: {
        receiver: "Dalily",
        account,
        amount: input.amount,
        currency: input.currency,
        reference: data.payment_reference,
      },
    };
  }

  /**
   * Requires `externalTransactionId` (the id the provider pasted after
   * sending via the Cham Cash app). Without it there's nothing to check
   * automatically — caller should fall back to manual receipt review.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("id, payment_status, payment_provider, external_transaction_id")
      .eq("id", input.paymentId)
      .maybeSingle();

    if (
      !payment ||
      payment.payment_provider !== "shamcash" ||
      (payment.payment_status !== "pending" && payment.payment_status !== "pending_review")
    ) {
      return { success: false, paymentId: input.paymentId };
    }

    const transactionId = input.externalTransactionId?.trim();
    if (!transactionId) {
      return { success: false, paymentId: input.paymentId };
    }

    // App-level pre-check against tx-id reuse; the DB also enforces this
    // with a partial unique index as the source of truth (see migration).
    const { data: existingUse } = await admin
      .from("payments")
      .select("id")
      .eq("payment_provider", "shamcash")
      .eq("external_transaction_id", transactionId)
      .neq("id", input.paymentId)
      .maybeSingle();
    if (existingUse) {
      return { success: false, paymentId: input.paymentId };
    }

    const verified = await verifyChamCashTransaction({ transactionId });
    if (!verified.ok) {
      return { success: false, paymentId: input.paymentId };
    }

    const account = getChamCashAccountAddress();
    if (account && verified.destinationAccount && verified.destinationAccount !== account) {
      return { success: false, paymentId: input.paymentId };
    }

    const { error: updateError } = await admin
      .from("payments")
      .update({ external_transaction_id: transactionId })
      .eq("id", input.paymentId)
      .in("payment_status", ["pending", "pending_review"]);
    // Unique index violation means another request won the race for this
    // tx id between our pre-check and now — treat as not verified.
    if (updateError) {
      return { success: false, paymentId: input.paymentId };
    }

    return {
      success: true,
      paymentId: payment.id,
      externalTransactionId: transactionId,
    };
  }

  async cancelPayment(paymentId: string): Promise<void> {
    const admin = createAdminClient();
    await admin
      .from("payments")
      .update({ payment_status: "cancelled" })
      .eq("id", paymentId)
      .eq("payment_provider", "shamcash");
  }

  async refund(
    paymentId: string,
    _options?: { amount?: number; currency?: string; reason?: string },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    // No refund API integrated — completed via admin workflow, like manual.
    void paymentId;
    void _options;
    return { ok: false, error: "shamcash_refund_via_admin_workflow" };
  }
}
