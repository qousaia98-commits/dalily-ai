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
import {
  checkChamCashPaymentRequestStatus,
  createChamCashPaymentRequest,
  verifyChamCashTransaction,
  type ChamCashVerifyResult,
} from "@/lib/payment/providers/shamcash-client";
import type { CreatePaymentInput, PaymentProvider, VerifyPaymentInput } from "@/lib/payment/types";
import type { CreatePaymentResult, VerifyPaymentResult } from "@/lib/subscription/types";

// provider_reference exists on payments (see baseline migration) but isn't
// in the generated Supabase types — same workaround stripe.provider.ts uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createAdminClient();
}

export class ShamCashPaymentProvider implements PaymentProvider {
  readonly name = "shamcash";

  /**
   * Tries the one-click hosted-checkout flow first (Tier 1); if Cham Cash
   * doesn't support it (or it's not wired up yet), falls back to the
   * account+amount instructions the provider pays manually and then
   * verifies with a pasted transaction id (Tier 2). The UI branches on
   * whether `checkoutUrl` came back — nothing else needs to know which
   * tier is active.
   */
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const admin = db();
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
        purpose: input.purpose ?? "subscription",
        unlock_session_id: input.unlockSessionId ?? null,
        idempotency_key: input.idempotencyKey ?? null,
      })
      .select("id, payment_reference")
      .single();

    if (error || !data) {
      throw new Error("payment_create_failed");
    }

    const paymentId = String(data.id);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

    const request = await createChamCashPaymentRequest({
      amount: input.amount,
      currency: input.currency,
      reference: data.payment_reference,
      returnUrl: `${appUrl}/business/subscription?shamcash_return=1&payment_id=${paymentId}`,
    });

    if (request.ok) {
      await admin
        .from("payments")
        .update({ provider_reference: request.providerPaymentId })
        .eq("id", paymentId);

      return {
        paymentId,
        checkoutUrl: request.redirectUrl,
        instructions: {
          receiver: "Dalily",
          account,
          amount: input.amount,
          currency: input.currency,
          reference: data.payment_reference,
        },
      };
    }

    return {
      paymentId,
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
   * Two ways in:
   * - `externalTransactionId` set → provider pasted it manually (Tier 2).
   * - omitted → poll Cham Cash for the hosted payment request created at
   *   checkout time, keyed by the stored `provider_reference` (Tier 1).
   * If neither confirms a payment, returns success:false — caller falls
   * back to manual receipt review, never auto-approves on uncertainty.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const admin = db();
    const { data: payment } = await admin
      .from("payments")
      .select("id, payment_status, payment_provider, external_transaction_id, provider_reference")
      .eq("id", input.paymentId)
      .maybeSingle();

    if (
      !payment ||
      payment.payment_provider !== "shamcash" ||
      (payment.payment_status !== "pending" && payment.payment_status !== "pending_review")
    ) {
      return { success: false, paymentId: input.paymentId };
    }

    const pastedTransactionId = input.externalTransactionId?.trim();
    let verified: ChamCashVerifyResult;

    if (pastedTransactionId) {
      const reused = await this.transactionIdAlreadyUsed(admin, pastedTransactionId, input.paymentId);
      if (reused) return { success: false, paymentId: input.paymentId };
      verified = await verifyChamCashTransaction({ transactionId: pastedTransactionId });
    } else if (payment.provider_reference) {
      verified = await checkChamCashPaymentRequestStatus({
        providerPaymentId: String(payment.provider_reference),
      });
    } else {
      return { success: false, paymentId: input.paymentId };
    }

    if (!verified.ok) {
      return { success: false, paymentId: input.paymentId };
    }

    // Polling path learns the transaction id only now — still guard reuse.
    if (!pastedTransactionId) {
      const reused = await this.transactionIdAlreadyUsed(admin, verified.transactionId, input.paymentId);
      if (reused) return { success: false, paymentId: input.paymentId };
    }

    const account = getChamCashAccountAddress();
    if (account && verified.destinationAccount && verified.destinationAccount !== account) {
      return { success: false, paymentId: input.paymentId };
    }

    const { error: updateError } = await admin
      .from("payments")
      .update({ external_transaction_id: verified.transactionId })
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
      externalTransactionId: verified.transactionId,
    };
  }

  /**
   * App-level pre-check against tx-id reuse; the DB also enforces this
   * with a partial unique index as the source of truth (see migration).
   */
  private async transactionIdAlreadyUsed(
    admin: ReturnType<typeof db>,
    transactionId: string,
    excludePaymentId: string,
  ): Promise<boolean> {
    const { data } = await admin
      .from("payments")
      .select("id")
      .eq("payment_provider", "shamcash")
      .eq("external_transaction_id", transactionId)
      .neq("id", excludePaymentId)
      .maybeSingle();
    return Boolean(data);
  }

  async cancelPayment(paymentId: string): Promise<void> {
    const admin = db();
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
