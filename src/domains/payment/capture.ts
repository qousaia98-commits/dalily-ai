/**
 * Single fail-closed capture path for verified server-side payment success.
 * Never trusts client-reported payment state.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePaymentProvider } from "@/lib/payment/payment.service";
import { logPaymentEvent } from "@/lib/payment/payment-events";
import { createInvoiceForPayment } from "@/lib/subscription/repository";
import { isUnlockPaymentsV2Enabled, isUnlockV2Enabled } from "@/lib/config/feature-flags";
import { completeUnlockSuccess } from "@/domains/unlock/session";
import { recordVerifiedPaymentEvent } from "@/domains/payment/webhook-ledger";

export type CaptureSource = "admin_approval" | "webhook";

/**
 * Mark unlock_fee payment paid and open contact grant.
 * Idempotent: re-entry after paid+grant returns success.
 */
export async function captureUnlockFeePayment(input: {
  paymentId: string;
  actorId: string;
  source: CaptureSource;
  externalEventId?: string;
}): Promise<
  | { ok: true; grantId: string; paymentId: string; alreadyCaptured: boolean }
  | { ok: false; error: string }
> {
  if (!isUnlockV2Enabled() || !isUnlockPaymentsV2Enabled()) {
    return { ok: false, error: "feature_disabled" };
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (!payment) return { ok: false, error: "payment_not_found" };
  if (payment.purpose !== "unlock_fee") {
    return { ok: false, error: "not_unlock_fee" };
  }
  if (!payment.unlock_session_id) {
    return { ok: false, error: "session_required" };
  }

  if (payment.payment_status === "paid") {
    const grant = await completeUnlockSuccess({
      sessionId: payment.unlock_session_id as string,
      actorUserId: input.actorId,
      mode: "payment_capture",
      paymentId: payment.id as string,
    });
    if (!grant.ok) return { ok: false, error: grant.error };
    return {
      ok: true,
      grantId: grant.grantId,
      paymentId: payment.id as string,
      alreadyCaptured: true,
    };
  }

  if (!["pending", "pending_review"].includes(payment.payment_status as string)) {
    return { ok: false, error: "invalid_status" };
  }

  const paymentProvider = resolvePaymentProvider();
  const verified = await paymentProvider.verifyPayment({
    paymentId: payment.id as string,
  });
  if (!verified.success) {
    return { ok: false, error: "payment_verify_failed" };
  }

  const externalEventId =
    input.externalEventId ??
    `${input.source}:${payment.id}:${payment.payment_reference}`;

  const ledger = await recordVerifiedPaymentEvent({
    provider: input.source === "webhook" ? "webhook" : "manual",
    externalEventId,
    eventType: "payment.succeeded",
    paymentId: payment.id as string,
    payload: {
      source: input.source,
      actorId: input.actorId,
      paymentId: payment.id,
      unlockSessionId: payment.unlock_session_id,
    },
  });

  if (ledger.status === "duplicate_processed") {
    const grant = await completeUnlockSuccess({
      sessionId: payment.unlock_session_id as string,
      actorUserId: input.actorId,
      mode: "payment_capture",
      paymentId: payment.id as string,
    });
    if (!grant.ok) return { ok: false, error: grant.error };
    return {
      ok: true,
      grantId: grant.grantId,
      paymentId: payment.id as string,
      alreadyCaptured: true,
    };
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: payErr } = await admin
    .from("payments")
    .update({
      payment_status: "paid",
      paid_at: nowIso,
      approved_at: nowIso,
      approved_by: input.actorId,
      external_transaction_id: verified.externalTransactionId ?? externalEventId,
    })
    .eq("id", payment.id)
    .in("payment_status", ["pending", "pending_review"])
    .select("id")
    .maybeSingle();

  if (payErr) return { ok: false, error: "payment_update_failed" };
  if (!updated) {
    const { data: again } = await admin
      .from("payments")
      .select("payment_status, unlock_session_id")
      .eq("id", payment.id)
      .maybeSingle();
    if (again?.payment_status === "paid" && again.unlock_session_id) {
      const grant = await completeUnlockSuccess({
        sessionId: again.unlock_session_id as string,
        actorUserId: input.actorId,
        mode: "payment_capture",
        paymentId: payment.id as string,
      });
      if (!grant.ok) return { ok: false, error: grant.error };
      return {
        ok: true,
        grantId: grant.grantId,
        paymentId: payment.id as string,
        alreadyCaptured: true,
      };
    }
    return { ok: false, error: "payment_update_failed" };
  }

  await logPaymentEvent({
    paymentId: payment.id as string,
    eventType: "approved",
    actorId: input.actorId,
  });

  await createInvoiceForPayment(
    payment.id as string,
    payment.provider_id as string,
    Number(payment.amount),
    payment.currency as string,
  );

  const grant = await completeUnlockSuccess({
    sessionId: payment.unlock_session_id as string,
    actorUserId: input.actorId,
    mode: "payment_capture",
    paymentId: payment.id as string,
  });

  if (!grant.ok) {
    await recordVerifiedPaymentEvent({
      provider: input.source === "webhook" ? "webhook" : "manual",
      externalEventId: `${externalEventId}:grant_failed`,
      eventType: "payment.grant_failed",
      paymentId: payment.id as string,
      payload: { error: grant.error },
      forceStatus: "failed",
      errorMessage: grant.error,
    });
    return { ok: false, error: grant.error };
  }

  await logPaymentEvent({
    paymentId: payment.id as string,
    eventType: "capture_correlated",
    actorId: input.actorId,
    note: `grant:${grant.grantId}`,
  });

  await recordVerifiedPaymentEvent({
    provider: input.source === "webhook" ? "webhook" : "manual",
    externalEventId,
    eventType: "payment.succeeded",
    paymentId: payment.id as string,
    payload: { grantId: grant.grantId },
    forceStatus: "processed",
  });

  return {
    ok: true,
    grantId: grant.grantId,
    paymentId: payment.id as string,
    alreadyCaptured: false,
  };
}

/**
 * Reject unlock fee payment (retry allowed). Does not touch subscriptions.
 */
export async function rejectUnlockFeePayment(input: {
  paymentId: string;
  actorId: string;
  adminNote?: string;
}): Promise<{ ok: true; providerId: string } | { ok: false; error: string }> {
  if (!isUnlockPaymentsV2Enabled()) return { ok: false, error: "feature_disabled" };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, provider_id, purpose, payment_status, unlock_session_id")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (!payment || payment.purpose !== "unlock_fee") {
    return { ok: false, error: "payment_not_found" };
  }
  if (!["pending", "pending_review"].includes(payment.payment_status as string)) {
    return { ok: false, error: "invalid_status" };
  }

  const now = new Date().toISOString();
  await admin
    .from("payments")
    .update({
      payment_status: "rejected",
      rejected_at: now,
      rejected_by: input.actorId,
      admin_note: input.adminNote?.trim() || null,
    })
    .eq("id", payment.id)
    .in("payment_status", ["pending", "pending_review"]);

  await logPaymentEvent({
    paymentId: payment.id as string,
    eventType: "rejected",
    actorId: input.actorId,
    note: input.adminNote?.trim() || null,
  });

  if (payment.unlock_session_id) {
    await admin
      .from("unlock_sessions")
      .update({ payment_id: null, updated_at: now })
      .eq("id", payment.unlock_session_id)
      .eq("payment_id", payment.id);
  }

  return { ok: true, providerId: payment.provider_id as string };
}
