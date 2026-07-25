/**
 * Unlock fee payment intents (Sprint 6).
 * Creates pending payments linked to unlock_sessions — never grants contact.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentConfig, isPaymentConfigured } from "@/lib/payment/config";
import { resolvePaymentProvider } from "@/lib/payment/payment.service";
import { allocateUniquePaymentReference } from "@/lib/payment/reference";
import { logPaymentEvent } from "@/lib/payment/payment-events";
import {
  isUnlockPaymentsV2Enabled,
  isUnlockV2Enabled,
} from "@/lib/config/feature-flags";

export type UnlockFeePaymentView = {
  paymentId: string;
  unlockSessionId: string;
  status: string;
  amount: number;
  currency: string;
  reference: string;
  receiver: string;
  account: string;
  swift?: string;
  bankName?: string;
  hasReceipt: boolean;
};

export async function getActiveUnlockFeePayment(
  unlockSessionId: string,
): Promise<UnlockFeePaymentView | null> {
  if (!isUnlockV2Enabled() || !isUnlockPaymentsV2Enabled()) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("payments")
    .select("*")
    .eq("unlock_session_id", unlockSessionId)
    .eq("purpose", "unlock_fee")
    .in("payment_status", ["pending", "pending_review", "paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const config = getPaymentConfig();
  return {
    paymentId: data.id as string,
    unlockSessionId,
    status: data.payment_status as string,
    amount: Number(data.amount),
    currency: data.currency as string,
    reference: data.payment_reference as string,
    receiver: config.receiver,
    account: config.account,
    swift: config.swift || undefined,
    bankName: config.bankName || undefined,
    hasReceipt: Boolean(data.receipt_path),
  };
}

/**
 * Idempotent: returns existing open/paid unlock payment for the session.
 */
export async function createUnlockFeePayment(input: {
  unlockSessionId: string;
  providerId: string;
}): Promise<
  | { ok: true; payment: UnlockFeePaymentView; reused: boolean }
  | { ok: false; error: string }
> {
  if (!isUnlockV2Enabled()) return { ok: false, error: "feature_disabled" };
  if (!isUnlockPaymentsV2Enabled()) return { ok: false, error: "payments_disabled" };

  const config = getPaymentConfig();
  if (!isPaymentConfigured(config)) {
    return { ok: false, error: "payment_not_configured" };
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("unlock_sessions")
    .select("id, provider_id, status, fee_amount, fee_currency, payment_id")
    .eq("id", input.unlockSessionId)
    .eq("provider_id", input.providerId)
    .maybeSingle();

  if (!session) return { ok: false, error: "session_not_found" };
  if (!["opened", "payment_pending"].includes(session.status as string)) {
    return { ok: false, error: "invalid_status" };
  }

  const existing = await getActiveUnlockFeePayment(input.unlockSessionId);
  if (existing) {
    return { ok: true, payment: existing, reused: true };
  }

  const reference = await allocateUniquePaymentReference();
  const idempotencyKey = `unlock_fee:${input.unlockSessionId}:${reference}`;
  const paymentProvider = resolvePaymentProvider();

  let created;
  try {
    created = await paymentProvider.createPayment({
      providerId: input.providerId,
      subscriptionId: null,
      amount: Number(session.fee_amount),
      currency: (session.fee_currency as string) || "SYP",
      reference,
      purpose: "unlock_fee",
      unlockSessionId: input.unlockSessionId,
      idempotencyKey,
    });
  } catch {
    // Race: another open payment may have won the unique index
    const raced = await getActiveUnlockFeePayment(input.unlockSessionId);
    if (raced) return { ok: true, payment: raced, reused: true };
    return { ok: false, error: "payment_create_failed" };
  }

  await logPaymentEvent({
    paymentId: created.paymentId,
    eventType: "requested",
  });

  const now = new Date().toISOString();
  await admin
    .from("unlock_sessions")
    .update({
      payment_id: created.paymentId,
      status: "payment_pending",
      updated_at: now,
    })
    .eq("id", input.unlockSessionId)
    .in("status", ["opened", "payment_pending"]);

  const view = await getActiveUnlockFeePayment(input.unlockSessionId);
  if (!view) return { ok: false, error: "payment_create_failed" };
  return { ok: true, payment: view, reused: false };
}

export async function cancelUnlockFeePayment(input: {
  paymentId: string;
  providerId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUnlockPaymentsV2Enabled()) return { ok: false, error: "payments_disabled" };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, provider_id, purpose, payment_status, unlock_session_id")
    .eq("id", input.paymentId)
    .eq("provider_id", input.providerId)
    .eq("purpose", "unlock_fee")
    .maybeSingle();

  if (!payment) return { ok: false, error: "payment_not_found" };
  if (payment.payment_status !== "pending") {
    // pending_review cannot be cancelled by provider (admin must reject)
    return { ok: false, error: "invalid_status" };
  }

  const { data: updated } = await admin
    .from("payments")
    .update({ payment_status: "cancelled" })
    .eq("id", payment.id)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (!updated) return { ok: false, error: "invalid_status" };

  await logPaymentEvent({
    paymentId: payment.id as string,
    eventType: "cancelled",
  });

  if (payment.unlock_session_id) {
    await admin
      .from("unlock_sessions")
      .update({
        payment_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.unlock_session_id)
      .eq("payment_id", payment.id);
  }

  return { ok: true };
}

export async function markUnlockFeePaymentFailed(input: {
  paymentId: string;
  actorId?: string | null;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, purpose, payment_status")
    .eq("id", input.paymentId)
    .eq("purpose", "unlock_fee")
    .maybeSingle();

  if (!payment) return { ok: false, error: "payment_not_found" };
  if (!["pending", "pending_review"].includes(payment.payment_status as string)) {
    return { ok: false, error: "invalid_status" };
  }

  await admin
    .from("payments")
    .update({
      payment_status: "failed",
      admin_note: input.note?.trim() || null,
    })
    .eq("id", payment.id)
    .in("payment_status", ["pending", "pending_review"]);

  await logPaymentEvent({
    paymentId: payment.id as string,
    eventType: "failed",
    actorId: input.actorId ?? null,
    note: input.note ?? null,
  });

  return { ok: true };
}
