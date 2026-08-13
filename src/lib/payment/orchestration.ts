/**
 * Sprint 6 Phase 2 — Payment Service (business orchestration).
 * UI and monetization call THIS — never Stripe/manual providers directly.
 */

import { resolvePaymentProvider } from "@/lib/payment/payment.service";
import { allocateUniquePaymentReference } from "@/lib/payment/reference";
import { logPaymentEvent } from "@/lib/payment/payment-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { snapshotPaymentStatus } from "@/lib/payment/status-snapshots";
import type {
  CreatePaymentIntentInput,
  PaymentIntentResult,
  PaymentLifecycleStatus,
  PaymentPurpose,
  PaymentRecord,
} from "@/lib/payment/canonical-types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapPayment(row: Record<string, unknown>): PaymentRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    purpose: (row.purpose as PaymentPurpose) || "subscription",
    amount: Number(row.amount),
    currency: String(row.currency ?? "USD"),
    status: row.payment_status as PaymentLifecycleStatus,
    paymentProvider: String(row.payment_provider ?? "manual"),
    reference: String(row.payment_reference ?? ""),
    providerReference: row.provider_reference
      ? String(row.provider_reference)
      : null,
    unlockSessionId: row.unlock_session_id
      ? String(row.unlock_session_id)
      : null,
    subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
    createdAt: String(row.created_at),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    failedAt: row.failed_at ? String(row.failed_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    expiredAt: row.expired_at ? String(row.expired_at) : null,
    receiptPath: row.receipt_path ? String(row.receipt_path) : null,
    hasReceipt: Boolean(row.receipt_path),
    refundedAmount: Number(row.refunded_amount ?? 0),
    refundStatus: (row.refund_status as PaymentRecord["refundStatus"]) ?? "none",
  };
}

/**
 * Idempotent payment intent creation via configured PaymentProvider.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<
  { ok: true; result: PaymentIntentResult } | { ok: false; error: string }
> {
  try {
    if (input.idempotencyKey) {
      const { data: existing } = await db()
        .from("payments")
        .select("*")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (existing) {
        return {
          ok: true,
          result: {
            paymentId: String(existing.id),
            reference: String(existing.payment_reference),
            amount: Number(existing.amount),
            currency: String(existing.currency),
            paymentProvider: String(existing.payment_provider ?? "manual"),
            reused: true,
          },
        };
      }
    }

    // Reuse open unlock payment for same session
    if (input.unlockSessionId) {
      const { data: open } = await db()
        .from("payments")
        .select("*")
        .eq("unlock_session_id", input.unlockSessionId)
        .in("payment_status", ["pending", "pending_review", "paid"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open) {
        return {
          ok: true,
          result: {
            paymentId: String(open.id),
            reference: String(open.payment_reference),
            amount: Number(open.amount),
            currency: String(open.currency),
            paymentProvider: String(open.payment_provider ?? "manual"),
            reused: true,
          },
        };
      }
    }

    const reference = await allocateUniquePaymentReference();
    const provider = resolvePaymentProvider();
    const created = await provider.createPayment({
      providerId: input.providerId,
      subscriptionId: input.subscriptionId ?? null,
      amount: input.amount,
      currency: input.currency,
      reference,
      purpose: input.purpose,
      unlockSessionId: input.unlockSessionId ?? null,
      idempotencyKey: input.idempotencyKey,
    });

    await db()
      .from("payments")
      .update({
        purpose: input.purpose,
        metadata: input.metadata ?? {},
      })
      .eq("id", created.paymentId);

    await snapshotPaymentStatus({
      paymentId: created.paymentId,
      fromStatus: null,
      toStatus: "pending",
      source: "system",
      note: "payment_created",
    });
    await logPaymentEvent({
      paymentId: created.paymentId,
      eventType: "requested",
    });

    return {
      ok: true,
      result: {
        paymentId: created.paymentId,
        reference: created.instructions?.reference ?? reference,
        amount: input.amount,
        currency: input.currency,
        paymentProvider: provider.name,
        instructions: created.instructions
          ? {
              receiver: created.instructions.receiver,
              account: created.instructions.account,
              swift: created.instructions.swift,
              bankName: created.instructions.bankName,
            }
          : undefined,
        clientSecret: created.clientSecret,
        checkoutUrl: created.checkoutUrl,
        stripePaymentIntentId: created.stripePaymentIntentId,
        stripeCheckoutSessionId: created.stripeCheckoutSessionId,
        publishableKey: created.publishableKey,
        reused: false,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "create_failed",
    };
  }
}

export async function getPaymentById(
  paymentId: string,
): Promise<PaymentRecord | null> {
  try {
    const { data } = await db()
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();
    return data ? mapPayment(data) : null;
  } catch {
    return null;
  }
}

export async function listProviderPayments(input: {
  providerId: string;
  purpose?: PaymentPurpose | "all";
  status?: PaymentLifecycleStatus | "all";
  query?: string;
  from?: string | null;
  to?: string | null;
  limit?: number;
}): Promise<PaymentRecord[]> {
  try {
    let q = db()
      .from("payments")
      .select("*")
      .eq("provider_id", input.providerId)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 100);

    if (input.purpose && input.purpose !== "all") {
      if (input.purpose === "lead_unlock") {
        q = q.in("purpose", ["unlock_fee", "lead_unlock"]);
      } else {
        q = q.eq("purpose", input.purpose);
      }
    }
    if (input.status && input.status !== "all") {
      q = q.eq("payment_status", input.status);
    }
    if (input.from) q = q.gte("created_at", input.from);
    if (input.to) q = q.lte("created_at", input.to);

    const { data } = await q;
    let rows = (data ?? []).map(mapPayment);
    if (input.query?.trim()) {
      const needle = input.query.trim().toLowerCase();
      rows = rows.filter(
        (p: PaymentRecord) =>
          p.reference.toLowerCase().includes(needle) ||
          p.id.toLowerCase().includes(needle),
      );
    }
    return rows;
  } catch {
    return [];
  }
}

export async function transitionPaymentStatus(input: {
  paymentId: string;
  toStatus: PaymentLifecycleStatus;
  actorUserId?: string | null;
  source?: "system" | "admin" | "webhook" | "provider" | "cron" | "user";
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { canTransitionPaymentStatus } = await import(
      "@/lib/payment/state-machine"
    );
    const { logFinancialAudit } = await import("@/domains/payment/audit");

    const current = await getPaymentById(input.paymentId);
    if (!current) return { ok: false, error: "not_found" };

    if (!canTransitionPaymentStatus(current.status, input.toStatus)) {
      await logFinancialAudit({
        actorId: input.actorUserId ?? null,
        action: "payment_transition",
        objectType: "payment",
        objectId: input.paymentId,
        oldState: { status: current.status },
        newState: { status: input.toStatus },
        result: "rejected",
        metadata: { reason: "invalid_transition", source: input.source },
      });
      return { ok: false, error: "invalid_transition" };
    }

    // Duplicate / no-op transition — idempotent success
    if (current.status === input.toStatus) {
      return { ok: true };
    }

    const patch: Record<string, unknown> = {
      payment_status: input.toStatus,
    };
    if (input.toStatus === "paid") patch.paid_at = new Date().toISOString();
    if (input.toStatus === "failed") patch.failed_at = new Date().toISOString();
    if (input.toStatus === "cancelled")
      patch.cancelled_at = new Date().toISOString();
    if (input.toStatus === "expired")
      patch.expired_at = new Date().toISOString();
    if (input.toStatus === "rejected")
      patch.rejected_at = new Date().toISOString();

    const { data, error } = await db()
      .from("payments")
      .update(patch)
      .eq("id", input.paymentId)
      .eq("payment_status", current.status)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) {
      // Concurrent transition — re-check
      const again = await getPaymentById(input.paymentId);
      if (again?.status === input.toStatus) return { ok: true };
      return { ok: false, error: "concurrent_transition" };
    }

    await snapshotPaymentStatus({
      paymentId: input.paymentId,
      fromStatus: current.status,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      source: input.source,
      note: input.note,
    });

    await logFinancialAudit({
      actorId: input.actorUserId ?? null,
      action: "payment_transition",
      objectType: "payment",
      objectId: input.paymentId,
      oldState: { status: current.status },
      newState: { status: input.toStatus },
      result: "success",
      metadata: { source: input.source, note: input.note ?? null },
    });

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "transition_failed",
    };
  }
}
