/**
 * Sprint 6 Phase 5 — refund workflow (request → admin → Stripe → credit note).
 * Does not rewrite paid → failed.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { getStripePaymentProvider } from "@/lib/payment/payment.service";
import { isStripeConfigured, toStripeAmount } from "@/lib/payment/stripe/client";
import { getStripe } from "@/lib/payment/stripe/client";
import { generateCreditNoteForRefund } from "@/lib/financial-documents/credit-note";
import type { RefundRequest, RefundStatus, RefundType } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapRefund(row: Record<string, unknown>): RefundRequest {
  return {
    id: String(row.id),
    paymentId: String(row.payment_id),
    providerId: String(row.provider_id),
    refundType: row.refund_type as RefundType,
    status: row.status as RefundStatus,
    originalAmount: Number(row.original_amount),
    refundAmount: Number(row.refund_amount),
    remainingAmount: Number(row.remaining_amount),
    currency: String(row.currency ?? "USD"),
    reason: String(row.reason ?? ""),
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    rejectedBy: row.rejected_by ? String(row.rejected_by) : null,
    rejectionReason: row.rejection_reason
      ? String(row.rejection_reason)
      : null,
    stripeRefundId: row.stripe_refund_id
      ? String(row.stripe_refund_id)
      : null,
    paymentReference: row.payment_reference
      ? String(row.payment_reference)
      : null,
    financialDocumentId: row.financial_document_id
      ? String(row.financial_document_id)
      : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function appendHistory(input: {
  refundRequestId: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId?: string | null;
  source?: "system" | "admin" | "provider" | "webhook" | "stripe";
  note?: string | null;
  payload?: Record<string, unknown>;
}) {
  const actor =
    input.actorUserId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.actorUserId,
    )
      ? input.actorUserId
      : null;
  await db().from("refund_history").insert({
    refund_request_id: input.refundRequestId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    actor_user_id: actor,
    source: input.source ?? "system",
    note: input.note ?? null,
    payload: input.payload ?? {},
  });
}

async function transition(
  refundId: string,
  from: RefundStatus | null,
  to: RefundStatus,
  patch: Record<string, unknown>,
  meta: {
    actorUserId?: string | null;
    source?: "system" | "admin" | "provider" | "webhook" | "stripe";
    note?: string | null;
  },
): Promise<RefundRequest | null> {
  const { data, error } = await db()
    .from("refund_requests")
    .update({
      ...patch,
      status: to,
      updated_at: new Date().toISOString(),
    })
    .eq("id", refundId)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  await appendHistory({
    refundRequestId: refundId,
    fromStatus: from,
    toStatus: to,
    actorUserId: meta.actorUserId,
    source: meta.source,
    note: meta.note,
  });
  return mapRefund(data);
}

export async function requestRefund(input: {
  paymentId: string;
  amount?: number | null;
  reason: string;
  requestedBy: string;
  refundType?: RefundType;
}): Promise<
  | { ok: true; refund: RefundRequest }
  | { ok: false; error: string }
> {
  const { data: payment } = await db()
    .from("payments")
    .select("*")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (!payment) return { ok: false, error: "payment_not_found" };
  if (payment.payment_status !== "paid") {
    return { ok: false, error: "payment_not_paid" };
  }

  const original = Number(payment.amount);
  const alreadyRefunded = Number(payment.refunded_amount ?? 0);
  const available = Math.round((original - alreadyRefunded) * 100) / 100;
  if (available <= 0) return { ok: false, error: "nothing_to_refund" };

  const refundAmount =
    input.amount != null && input.amount > 0
      ? Math.round(Number(input.amount) * 100) / 100
      : available;

  if (refundAmount > available + 1e-9) {
    return { ok: false, error: "amount_exceeds_remaining" };
  }

  // Open refund already?
  const { data: open } = await db()
    .from("refund_requests")
    .select("id")
    .eq("payment_id", input.paymentId)
    .in("status", ["requested", "pending", "approved", "processing"])
    .limit(1)
    .maybeSingle();
  if (open) return { ok: false, error: "refund_already_open" };

  const isFull = refundAmount >= available - 1e-9;
  const refundType: RefundType =
    input.refundType ??
    (payment.payment_provider === "manual"
      ? "manual"
      : isFull
        ? "full"
        : "partial");

  const remaining = Math.round((available - refundAmount) * 100) / 100;

  const { data: created, error } = await db()
    .from("refund_requests")
    .insert({
      payment_id: input.paymentId,
      provider_id: payment.provider_id,
      refund_type: refundType,
      status: "requested",
      original_amount: original,
      refund_amount: refundAmount,
      remaining_amount: remaining,
      currency: payment.currency ?? "USD",
      reason: input.reason.trim().slice(0, 2000),
      requested_by: input.requestedBy,
      payment_reference: payment.payment_reference,
    })
    .select("*")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "create_failed" };
  }

  await appendHistory({
    refundRequestId: String(created.id),
    fromStatus: null,
    toStatus: "requested",
    actorUserId: input.requestedBy,
    source: "provider",
    note: "refund_requested",
  });

  await db()
    .from("payments")
    .update({ refund_status: "pending" })
    .eq("id", input.paymentId);

  void emitAiLearningEvent({
    eventType: "refund_requested",
    providerId: String(payment.provider_id),
    metadata: {
      anonymized: true,
      refundAmount,
      refundType,
    },
  });

  return { ok: true, refund: mapRefund(created) };
}

export async function rejectRefund(input: {
  refundId: string;
  adminUserId: string;
  reason?: string;
}): Promise<{ ok: true; refund: RefundRequest } | { ok: false; error: string }> {
  const { data: row } = await db()
    .from("refund_requests")
    .select("*")
    .eq("id", input.refundId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (!["requested", "pending"].includes(String(row.status))) {
    return { ok: false, error: "invalid_status" };
  }

  const updated = await transition(
    input.refundId,
    row.status as RefundStatus,
    "rejected",
    {
      rejected_by: input.adminUserId,
      rejection_reason: (input.reason ?? "").slice(0, 2000) || null,
    },
    {
      actorUserId: input.adminUserId,
      source: "admin",
      note: "refund_rejected",
    },
  );
  if (!updated) return { ok: false, error: "update_failed" };

  // Clear pending if no other open refunds
  await db()
    .from("payments")
    .update({
      refund_status:
        Number(
          (
            await db()
              .from("payments")
              .select("refunded_amount")
              .eq("id", row.payment_id)
              .maybeSingle()
          ).data?.refunded_amount ?? 0,
        ) > 0
          ? "partial"
          : "none",
    })
    .eq("id", row.payment_id);

  void emitAiLearningEvent({
    eventType: "refund_rejected",
    providerId: String(row.provider_id),
    metadata: { anonymized: true },
  });

  return { ok: true, refund: updated };
}

/**
 * Admin approval → Stripe (or manual complete) → credit note on success.
 */
export async function approveRefund(input: {
  refundId: string;
  adminUserId: string;
}): Promise<{ ok: true; refund: RefundRequest } | { ok: false; error: string }> {
  const { data: row } = await db()
    .from("refund_requests")
    .select("*")
    .eq("id", input.refundId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (!["requested", "pending"].includes(String(row.status))) {
    return { ok: false, error: "invalid_status" };
  }

  const approved = await transition(
    input.refundId,
    row.status as RefundStatus,
    "approved",
    { approved_by: input.adminUserId },
    {
      actorUserId: input.adminUserId,
      source: "admin",
      note: "refund_approved",
    },
  );
  if (!approved) return { ok: false, error: "approve_failed" };

  void emitAiLearningEvent({
    eventType: "refund_approved",
    providerId: String(row.provider_id),
    metadata: { anonymized: true },
  });

  // Manual / no Stripe → complete locally
  const { data: payment } = await db()
    .from("payments")
    .select("*")
    .eq("id", row.payment_id)
    .maybeSingle();

  const useStripe =
    payment?.payment_provider === "stripe" &&
    isStripeConfigured() &&
    row.refund_type !== "manual";

  if (!useStripe) {
    return completeRefundSuccess({
      refundId: input.refundId,
      actorUserId: input.adminUserId,
      source: "admin",
      stripeRefundId: null,
    });
  }

  const processing = await transition(
    input.refundId,
    "approved",
    "processing",
    {},
    {
      actorUserId: input.adminUserId,
      source: "admin",
      note: "stripe_refund_started",
    },
  );
  if (!processing) return { ok: false, error: "processing_failed" };

  try {
    const stripe = getStripe();
    const amountMinor = toStripeAmount(
      Number(row.refund_amount),
      String(row.currency ?? "USD"),
    );
    const params: {
      payment_intent?: string;
      charge?: string;
      amount: number;
      reason?: "requested_by_customer" | "duplicate" | "fraudulent";
      metadata: Record<string, string>;
    } = {
      amount: amountMinor,
      reason: "requested_by_customer",
      metadata: {
        dalily_refund_id: input.refundId,
        dalily_payment_id: String(row.payment_id),
      },
    };
    if (payment.stripe_payment_intent_id) {
      params.payment_intent = String(payment.stripe_payment_intent_id);
    } else if (payment.stripe_charge_id) {
      params.charge = String(payment.stripe_charge_id);
    } else {
      await transition(input.refundId, "processing", "failed", {}, {
        actorUserId: input.adminUserId,
        source: "stripe",
        note: "no_stripe_charge",
      });
      return { ok: false, error: "no_stripe_charge" };
    }

    const refund = await stripe.refunds.create(params, {
      idempotencyKey: `refund:${input.refundId}`,
    });

    await db()
      .from("refund_requests")
      .update({
        stripe_refund_id: refund.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.refundId);

    // If Stripe already succeeded synchronously
    if (refund.status === "succeeded") {
      return completeRefundSuccess({
        refundId: input.refundId,
        actorUserId: input.adminUserId,
        source: "stripe",
        stripeRefundId: refund.id,
      });
    }

    const { data: fresh } = await db()
      .from("refund_requests")
      .select("*")
      .eq("id", input.refundId)
      .single();
    return { ok: true, refund: mapRefund(fresh) };
  } catch (e) {
    await transition(input.refundId, "processing", "failed", {}, {
      actorUserId: input.adminUserId,
      source: "stripe",
      note: e instanceof Error ? e.message : "stripe_refund_failed",
    });
    void emitAiLearningEvent({
      eventType: "refund_failed",
      providerId: String(row.provider_id),
      metadata: { anonymized: true },
    });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "stripe_refund_failed",
    };
  }
}

export async function completeRefundSuccess(input: {
  refundId: string;
  actorUserId?: string | null;
  source: "admin" | "webhook" | "stripe";
  stripeRefundId?: string | null;
}): Promise<{ ok: true; refund: RefundRequest } | { ok: false; error: string }> {
  const { data: row } = await db()
    .from("refund_requests")
    .select("*")
    .eq("id", input.refundId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (row.status === "succeeded") {
    return { ok: true, refund: mapRefund(row) };
  }
  // Allow recovery from failed via webhook success; reject terminal cancel/reject.
  if (
    !["approved", "processing", "requested", "pending", "failed"].includes(
      String(row.status),
    )
  ) {
    return { ok: false, error: "invalid_status" };
  }

  const { data: payment } = await db()
    .from("payments")
    .select("*")
    .eq("id", row.payment_id)
    .maybeSingle();
  if (!payment) return { ok: false, error: "payment_not_found" };

  const prevRefunded = Number(payment.refunded_amount ?? 0);
  const nextRefunded =
    Math.round((prevRefunded + Number(row.refund_amount)) * 100) / 100;
  const original = Number(payment.amount);
  const refundStatus =
    nextRefunded >= original - 1e-9 ? "full" : "partial";

  await db()
    .from("payments")
    .update({
      refunded_amount: nextRefunded,
      refund_status: refundStatus,
    })
    .eq("id", row.payment_id);

  const updated = await transition(
    input.refundId,
    row.status as RefundStatus,
    "succeeded",
    {
      completed_at: new Date().toISOString(),
      stripe_refund_id: input.stripeRefundId ?? row.stripe_refund_id,
    },
    {
      actorUserId: input.actorUserId,
      source: input.source,
      note: "refund_succeeded",
    },
  );
  if (!updated) return { ok: false, error: "complete_failed" };

  // Credit note PDF
  try {
    const credit = await generateCreditNoteForRefund({
      refundRequestId: input.refundId,
      actorUserId: input.actorUserId ?? null,
    });
    if (credit.ok) {
      await db()
        .from("refund_requests")
        .update({ financial_document_id: credit.document.id })
        .eq("id", input.refundId);
      updated.financialDocumentId = credit.document.id;
    }
  } catch {
    // soft
  }

  void emitAiLearningEvent({
    eventType: "refund_completed",
    providerId: String(row.provider_id),
    metadata: {
      anonymized: true,
      refundAmount: Number(row.refund_amount),
      refundStatus,
    },
  });

  // Keep PaymentProvider.refund interface usable (no business side-effects beyond Stripe)
  void getStripePaymentProvider;

  return { ok: true, refund: updated };
}

export async function markRefundFailed(input: {
  refundId: string;
  note?: string;
}): Promise<void> {
  const { data: row } = await db()
    .from("refund_requests")
    .select("id, status, provider_id")
    .eq("id", input.refundId)
    .maybeSingle();
  if (!row || row.status === "succeeded") return;
  await transition(
    input.refundId,
    row.status as RefundStatus,
    "failed",
    {},
    { source: "webhook", note: input.note ?? "refund_failed" },
  );
  void emitAiLearningEvent({
    eventType: "refund_failed",
    providerId: String(row.provider_id),
    metadata: { anonymized: true },
  });
}

export async function getRefundById(
  refundId: string,
): Promise<RefundRequest | null> {
  const { data } = await db()
    .from("refund_requests")
    .select("*")
    .eq("id", refundId)
    .maybeSingle();
  return data ? mapRefund(data) : null;
}

export async function findRefundByStripeId(
  stripeRefundId: string,
): Promise<RefundRequest | null> {
  const { data } = await db()
    .from("refund_requests")
    .select("*")
    .eq("stripe_refund_id", stripeRefundId)
    .maybeSingle();
  return data ? mapRefund(data) : null;
}

export async function listRefunds(input: {
  providerId?: string | null;
  status?: RefundStatus | "all";
  query?: string;
  limit?: number;
}): Promise<RefundRequest[]> {
  try {
    let q = db()
      .from("refund_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 100);
    if (input.providerId) q = q.eq("provider_id", input.providerId);
    if (input.status && input.status !== "all") q = q.eq("status", input.status);
    const { data } = await q;
    let rows = (data ?? []).map(mapRefund);
    if (input.query?.trim()) {
      const needle = input.query.trim().toLowerCase();
      rows = rows.filter(
        (r: RefundRequest) =>
          r.id.includes(needle) ||
          r.paymentId.includes(needle) ||
          (r.paymentReference ?? "").toLowerCase().includes(needle) ||
          (r.stripeRefundId ?? "").toLowerCase().includes(needle),
      );
    }
    return rows;
  } catch {
    return [];
  }
}

export async function findOpenRefundForPayment(
  paymentId: string,
): Promise<RefundRequest | null> {
  const { data } = await db()
    .from("refund_requests")
    .select("*")
    .eq("payment_id", paymentId)
    .in("status", ["requested", "pending", "approved", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapRefund(data) : null;
}

export async function listRefundHistory(
  refundRequestId: string,
): Promise<
  Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    source: string;
    note: string | null;
    createdAt: string;
  }>
> {
  const { data } = await db()
    .from("refund_history")
    .select("*")
    .eq("refund_request_id", refundRequestId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    fromStatus: row.from_status ? String(row.from_status) : null,
    toStatus: String(row.to_status),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    source: String(row.source ?? "system"),
    note: row.note ? String(row.note) : null,
    createdAt: String(row.created_at),
  }));
}

export async function getRefundStats(): Promise<{
  total: number;
  requested: number;
  succeeded: number;
  failed: number;
  refundedUsd: number;
}> {
  try {
    const { data } = await db()
      .from("refund_requests")
      .select("status, refund_amount, currency")
      .limit(5000);
    const rows = data ?? [];
    let refundedUsd = 0;
    for (const r of rows) {
      if (r.status === "succeeded" && String(r.currency).toUpperCase() === "USD") {
        refundedUsd += Number(r.refund_amount);
      }
    }
    return {
      total: rows.length,
      requested: rows.filter((r: { status: string }) =>
        ["requested", "pending"].includes(r.status),
      ).length,
      succeeded: rows.filter((r: { status: string }) => r.status === "succeeded")
        .length,
      failed: rows.filter((r: { status: string }) => r.status === "failed")
        .length,
      refundedUsd: Math.round(refundedUsd * 100) / 100,
    };
  } catch {
    return { total: 0, requested: 0, succeeded: 0, failed: 0, refundedUsd: 0 };
  }
}
