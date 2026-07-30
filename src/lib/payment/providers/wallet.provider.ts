/**
 * Wallet payment adapter — settles against user wallet balances (no external PSP).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { applyWalletLedgerEntry, getOrCreateWallet } from "@/domains/payment/wallet/service";
import { isPaymentWalletEnabled } from "@/lib/config/feature-flags";
import type {
  CreatePaymentInput,
  PaymentProvider,
  VerifyPaymentInput,
} from "@/lib/payment/types";
import type { CreatePaymentResult, VerifyPaymentResult } from "@/lib/subscription/types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export class WalletPaymentProvider implements PaymentProvider {
  readonly name = "wallet";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!isPaymentWalletEnabled()) {
      throw new Error("wallet_disabled");
    }

    const { data, error } = await db()
      .from("payments")
      .insert({
        provider_id: input.providerId,
        subscription_id: input.subscriptionId ?? null,
        payment_provider: "wallet",
        payment_status: "pending",
        amount: input.amount,
        currency: input.currency,
        payment_reference: input.reference,
        purpose: input.purpose ?? "wallet",
        unlock_session_id: input.unlockSessionId ?? null,
        idempotency_key: input.idempotencyKey ?? null,
      })
      .select("id, payment_reference")
      .single();

    if (error || !data) throw new Error("payment_create_failed");

    return {
      paymentId: data.id,
      instructions: {
        receiver: "Dalily Wallet",
        account: "wallet",
        amount: input.amount,
        currency: input.currency,
        reference: data.payment_reference,
      },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!isPaymentWalletEnabled()) {
      return { success: false, paymentId: input.paymentId };
    }

    const { data: payment } = await db()
      .from("payments")
      .select("id, payment_status, amount, currency, metadata")
      .eq("id", input.paymentId)
      .maybeSingle();

    if (!payment || payment.payment_status === "paid") {
      return {
        success: payment?.payment_status === "paid",
        paymentId: input.paymentId,
      };
    }

    const meta = (payment.metadata ?? {}) as { customerId?: string };
    const customerId = meta.customerId;
    if (!customerId) {
      return { success: false, paymentId: input.paymentId };
    }

    const wallet = await getOrCreateWallet({
      userId: customerId,
      currency: String(payment.currency ?? "SYP"),
    });
    if (!wallet || wallet.available < Number(payment.amount)) {
      return { success: false, paymentId: input.paymentId };
    }

    const debited = await applyWalletLedgerEntry({
      userId: customerId,
      entryType: "debit",
      amount: Number(payment.amount),
      currency: String(payment.currency ?? "SYP"),
      paymentId: input.paymentId,
      idempotencyKey: `wallet-pay:${input.paymentId}`,
      description: "Wallet payment",
    });

    if (!debited.ok) {
      return { success: false, paymentId: input.paymentId };
    }

    return {
      success: true,
      paymentId: payment.id,
      externalTransactionId: input.externalTransactionId ?? `wallet:${input.paymentId}`,
    };
  }

  async cancelPayment(paymentId: string): Promise<void> {
    await db().from("payments").update({ payment_status: "cancelled" }).eq("id", paymentId);
  }

  async refund(
    paymentId: string,
    options?: { amount?: number; currency?: string; reason?: string },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const { data: payment } = await db()
      .from("payments")
      .select("id, amount, currency, metadata")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment) return { ok: false, error: "not_found" };

    const meta = (payment.metadata ?? {}) as { customerId?: string };
    if (!meta.customerId) return { ok: false, error: "no_customer" };

    const amount = options?.amount ?? Number(payment.amount);
    const credited = await applyWalletLedgerEntry({
      userId: meta.customerId,
      entryType: "refund",
      amount,
      currency: options?.currency ?? String(payment.currency ?? "SYP"),
      paymentId,
      idempotencyKey: `wallet-refund:${paymentId}:${amount}`,
      description: options?.reason ?? "Wallet refund",
    });

    return credited.ok ? { ok: true } : { ok: false, error: credited.error };
  }
}
