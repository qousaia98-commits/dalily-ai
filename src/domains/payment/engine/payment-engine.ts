/**
 * Enterprise payment engine — init / auth / capture / release / refund / cancel / retry.
 * Talks only through PaymentProvider adapters + domain engines (never PSP SDKs).
 *
 * ---------------------------------------------------------------------------
 * UNWIRED / DEAD CODE PATH (pending product decision) — DO NOT DELETE YET
 * ---------------------------------------------------------------------------
 * Gated by isPaymentsV2Enabled(). Re-exported from `@/domains/payment` and
 * `@/domains/payment/refunds`, but as of RC2.1 there are **no call sites**
 * under `src/` that invoke initializePayment / authorizePayment / capturePayment /
 * reserveInEscrow / releaseEscrowFunds / refundPayment / cancelPaymentEngine /
 * retryFailedPayment (only the barrel re-exports themselves).
 *
 * Keep until we deliberately: (a) wire marketplace flows to this engine,
 * (b) archive it under docs/legacy, or (c) remove after a money-path review.
 * ---------------------------------------------------------------------------
 */

import {
  createPaymentIntent,
  getPaymentById,
  transitionPaymentStatus,
} from "@/lib/payment/orchestration";
import { resolvePaymentProvider } from "@/lib/payment/payment.service";
import { isPaymentsV2Enabled, isEscrowEngineEnabled } from "@/lib/config/feature-flags";
import { calculateFeeBreakdown } from "@/domains/payment/fees/engine";
import {
  createEscrowHold,
  releaseEscrow,
  refundEscrow,
  cancelEscrow,
} from "@/domains/payment/escrow/engine";
import { emitPaymentTimelineEvent } from "@/domains/payment/shared/timeline";
import { requestRefund } from "@/lib/refunds";
import type { FeeBreakdown } from "@/domains/payment/shared/types";
import type { PaymentIntentResult, PaymentRecord } from "@/lib/payment/canonical-types";

export type InitializePaymentInput = {
  providerId: string;
  customerId: string;
  amount: number;
  currency?: string;
  purpose?: "escrow" | "marketplace_job" | "wallet" | "fee";
  idempotencyKey: string;
  unlockSessionId?: string | null;
  serviceRequestId?: string | null;
  conversationId?: string | null;
  discountAmount?: number;
  metadata?: Record<string, unknown>;
};

export async function initializePayment(
  input: InitializePaymentInput,
): Promise<
  | {
      ok: true;
      result: PaymentIntentResult;
      fees: FeeBreakdown;
    }
  | { ok: false; error: string }
> {
  if (!isPaymentsV2Enabled()) return { ok: false, error: "feature_disabled" };

  const fees = await calculateFeeBreakdown({
    amount: input.amount,
    currency: input.currency,
    discountAmount: input.discountAmount,
  });

  const created = await createPaymentIntent({
    providerId: input.providerId,
    purpose: input.purpose ?? "marketplace_job",
    amount: fees.totalCharged,
    currency: fees.currency,
    unlockSessionId: input.unlockSessionId,
    idempotencyKey: input.idempotencyKey,
    metadata: {
      ...(input.metadata ?? {}),
      customerId: input.customerId,
      serviceRequestId: input.serviceRequestId ?? null,
      conversationId: input.conversationId ?? null,
      fees,
    },
  });

  if (!created.ok) return created;

  await emitPaymentTimelineEvent({
    conversationId: input.conversationId,
    actorId: input.customerId,
    event: "payment_initiated",
  });

  return { ok: true, result: created.result, fees };
}

export async function authorizePayment(input: {
  paymentId: string;
  actorId: string;
  conversationId?: string | null;
}): Promise<{ ok: true; payment: PaymentRecord } | { ok: false; error: string }> {
  if (!isPaymentsV2Enabled()) return { ok: false, error: "feature_disabled" };
  const payment = await getPaymentById(input.paymentId);
  if (!payment) return { ok: false, error: "not_found" };

  const transitioned = await transitionPaymentStatus({
    paymentId: input.paymentId,
    toStatus: "authorized",
    actorUserId: input.actorId,
    source: "system",
    note: "authorized",
  });
  if (!transitioned.ok) return transitioned;

  await emitPaymentTimelineEvent({
    conversationId: input.conversationId,
    actorId: input.actorId,
    event: "payment_authorized",
  });

  const updated = await getPaymentById(input.paymentId);
  return updated
    ? { ok: true, payment: updated }
    : { ok: false, error: "not_found" };
}

export async function capturePayment(input: {
  paymentId: string;
  actorId: string;
  conversationId?: string | null;
}): Promise<{ ok: true; payment: PaymentRecord } | { ok: false; error: string }> {
  if (!isPaymentsV2Enabled()) return { ok: false, error: "feature_disabled" };
  const payment = await getPaymentById(input.paymentId);
  if (!payment) return { ok: false, error: "not_found" };

  // Adapter verify when external reference present
  try {
    const adapter = resolvePaymentProvider();
    await adapter.verifyPayment({ paymentId: input.paymentId });
  } catch {
    // Manual rails may not verify yet — continue to capture status
  }

  const transitioned = await transitionPaymentStatus({
    paymentId: input.paymentId,
    toStatus: "paid",
    actorUserId: input.actorId,
    source: "system",
    note: "captured",
  });
  if (!transitioned.ok) return transitioned;

  const updated = await getPaymentById(input.paymentId);
  return updated
    ? { ok: true, payment: updated }
    : { ok: false, error: "not_found" };
}

export async function reserveInEscrow(input: {
  paymentId: string;
  customerId: string;
  providerId: string;
  amount: number;
  currency?: string;
  serviceRequestId?: string | null;
  conversationId?: string | null;
  bookingId?: string | null;
  fundedVia?: "external" | "wallet";
  actorId: string;
  idempotencyKey: string;
}) {
  if (!isEscrowEngineEnabled()) return { ok: false as const, error: "feature_disabled" };
  return createEscrowHold({
    ...input,
    paymentId: input.paymentId,
  });
}

export async function releaseEscrowFunds(input: {
  escrowId: string;
  actorId: string;
  emergencyAdmin?: boolean;
}) {
  return releaseEscrow(input);
}

export async function refundPayment(input: {
  paymentId: string;
  actorId: string;
  amount?: number;
  reason: string;
  escrowId?: string | null;
  conversationId?: string | null;
  partial?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPaymentsV2Enabled()) return { ok: false, error: "feature_disabled" };

  if (input.escrowId) {
    const result = await refundEscrow({
      escrowId: input.escrowId,
      actorId: input.actorId,
      amount: input.amount,
      reason: input.reason,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  const payment = await getPaymentById(input.paymentId);
  if (!payment) return { ok: false, error: "not_found" };

  const refundAmount = input.amount ?? payment.amount;
  const created = await requestRefund({
    paymentId: input.paymentId,
    refundType: input.partial || refundAmount < payment.amount ? "partial" : "full",
    amount: refundAmount,
    reason: input.reason,
    requestedBy: input.actorId,
  });

  if (!created.ok) return { ok: false, error: created.error };

  await emitPaymentTimelineEvent({
    conversationId: input.conversationId,
    actorId: input.actorId,
    event: "payment_refunded",
  });

  return { ok: true };
}

export async function cancelPaymentEngine(input: {
  paymentId: string;
  actorId: string;
  escrowId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPaymentsV2Enabled()) return { ok: false, error: "feature_disabled" };

  if (input.escrowId) {
    const cancelled = await cancelEscrow({
      escrowId: input.escrowId,
      actorId: input.actorId,
    });
    if (!cancelled.ok) return cancelled;
  }

  try {
    const adapter = resolvePaymentProvider();
    await adapter.cancelPayment(input.paymentId);
  } catch {
    // fall through to status transition
  }

  return transitionPaymentStatus({
    paymentId: input.paymentId,
    toStatus: "cancelled",
    actorUserId: input.actorId,
    source: "system",
    note: "cancelled",
  });
}

export async function retryFailedPayment(input: {
  paymentId: string;
  actorId: string;
  customerId: string;
  providerId: string;
  amount: number;
  currency?: string;
  idempotencyKey: string;
  conversationId?: string | null;
}) {
  return initializePayment({
    providerId: input.providerId,
    customerId: input.customerId,
    amount: input.amount,
    currency: input.currency,
    idempotencyKey: input.idempotencyKey,
    conversationId: input.conversationId,
    purpose: "marketplace_job",
    metadata: { retryOf: input.paymentId, actorId: input.actorId },
  });
}
