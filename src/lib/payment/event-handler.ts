/**
 * Sprint 6 Phase 2 — canonical payment events → business outcomes.
 * Providers report events only; no Stripe/manual-specific branching here.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { captureUnlockFeePayment } from "@/domains/payment/capture";
import { markUnlockFeePaymentFailed } from "@/domains/payment/unlock-fee";
import { activateBusinessSubscriptionFromPayment } from "@/lib/payment/business-subscription";
import { transitionPaymentStatus } from "@/lib/payment/orchestration";
import { snapshotPaymentStatus } from "@/lib/payment/status-snapshots";
import type { CanonicalPaymentEventType } from "@/lib/payment/canonical-types";

export type ApplyPaymentEventResult =
  | {
      ok: true;
      duplicate: boolean;
      paymentId: string;
      grantId?: string;
      handled: CanonicalPaymentEventType | "legacy";
    }
  | { ok: false; error: string; status?: number };

/** Normalize dotted (legacy) and underscored (canonical) event names. */
export function normalizePaymentEventType(
  raw: string,
): CanonicalPaymentEventType | null {
  const t = raw.trim().toLowerCase().replace(/\./g, "_");
  const map: Record<string, CanonicalPaymentEventType> = {
    payment_succeeded: "payment_succeeded",
    payment_failed: "payment_failed",
    payment_cancelled: "payment_cancelled",
    payment_canceled: "payment_cancelled",
    payment_expired: "payment_expired",
    subscription_renewed: "subscription_renewed",
    subscription_cancelled: "subscription_cancelled",
    subscription_canceled: "subscription_cancelled",
    refund_succeeded: "refund_succeeded",
    refund_failed: "refund_failed",
  };
  return map[t] ?? null;
}

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

/**
 * Apply a verified provider event to payment + domain side-effects.
 */
export async function applyCanonicalPaymentEvent(input: {
  paymentId: string;
  eventType: CanonicalPaymentEventType;
  actorId: string;
  externalEventId: string;
  source: "webhook";
}): Promise<ApplyPaymentEventResult> {
  const { data: payment } = await db()
    .from("payments")
    .select("id, purpose, payment_status, provider_id")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (!payment) {
    return { ok: false, error: "payment_not_found", status: 404 };
  }

  const purpose = String(payment.purpose ?? "");
  const isLead =
    purpose === "unlock_fee" || purpose === "lead_unlock";
  const isBusinessSub = purpose === "business_subscription";

  if (input.eventType === "payment_succeeded") {
    if (isLead) {
      const captured = await captureUnlockFeePayment({
        paymentId: input.paymentId,
        actorId: input.actorId,
        source: "webhook",
        externalEventId: input.externalEventId,
      });
      if (!captured.ok) {
        return { ok: false, error: captured.error, status: 409 };
      }
      return {
        ok: true,
        duplicate: captured.alreadyCaptured,
        paymentId: captured.paymentId,
        grantId: captured.grantId,
        handled: "payment_succeeded",
      };
    }

    if (isBusinessSub) {
      const activated = await activateBusinessSubscriptionFromPayment({
        paymentId: input.paymentId,
        actorUserId: input.actorId,
        source: "webhook",
      });
      if (!activated.ok) {
        return { ok: false, error: activated.error, status: 409 };
      }
      return {
        ok: true,
        duplicate: false,
        paymentId: input.paymentId,
        handled: "payment_succeeded",
      };
    }

    // Legacy subscription: leave to admin rail
    return {
      ok: true,
      duplicate: false,
      paymentId: input.paymentId,
      handled: "legacy",
    };
  }

  if (input.eventType === "subscription_renewed") {
    if (!isBusinessSub) {
      return {
        ok: true,
        duplicate: false,
        paymentId: input.paymentId,
        handled: "subscription_renewed",
      };
    }
    const activated = await activateBusinessSubscriptionFromPayment({
      paymentId: input.paymentId,
      actorUserId: input.actorId,
      source: "webhook",
    });
    if (!activated.ok) {
      return { ok: false, error: activated.error, status: 409 };
    }
    return {
      ok: true,
      duplicate: false,
      paymentId: input.paymentId,
      handled: "subscription_renewed",
    };
  }

  if (input.eventType === "payment_failed") {
    if (isLead) {
      await markUnlockFeePaymentFailed({
        paymentId: input.paymentId,
        actorId: input.actorId,
        note: "webhook:payment_failed",
      });
    } else {
      await transitionPaymentStatus({
        paymentId: input.paymentId,
        toStatus: "failed",
        actorUserId: input.actorId,
        source: "webhook",
        note: "payment_failed",
      });
    }
    return {
      ok: true,
      duplicate: false,
      paymentId: input.paymentId,
      handled: "payment_failed",
    };
  }

  if (input.eventType === "payment_cancelled") {
    if (["pending", "pending_review"].includes(String(payment.payment_status))) {
      await transitionPaymentStatus({
        paymentId: input.paymentId,
        toStatus: "cancelled",
        actorUserId: input.actorId,
        source: "webhook",
        note: "payment_cancelled",
      });
    }
    return {
      ok: true,
      duplicate: false,
      paymentId: input.paymentId,
      handled: "payment_cancelled",
    };
  }

  if (input.eventType === "payment_expired") {
    if (["pending", "pending_review"].includes(String(payment.payment_status))) {
      await transitionPaymentStatus({
        paymentId: input.paymentId,
        toStatus: "expired",
        actorUserId: input.actorId,
        source: "webhook",
        note: "payment_expired",
      });
    }
    return {
      ok: true,
      duplicate: false,
      paymentId: input.paymentId,
      handled: "payment_expired",
    };
  }

  if (input.eventType === "subscription_cancelled") {
    if (isBusinessSub) {
      await snapshotPaymentStatus({
        paymentId: input.paymentId,
        fromStatus: payment.payment_status as string,
        toStatus: payment.payment_status as string,
        actorUserId: input.actorId,
        source: "webhook",
        note: "subscription_cancelled_reported",
      });
    }
    return {
      ok: true,
      duplicate: false,
      paymentId: input.paymentId,
      handled: "subscription_cancelled",
    };
  }

  // Refund stubs — acknowledge only
  if (
    input.eventType === "refund_succeeded" ||
    input.eventType === "refund_failed"
  ) {
    return {
      ok: true,
      duplicate: false,
      paymentId: input.paymentId,
      handled: input.eventType,
    };
  }

  return { ok: false, error: "unhandled_event_type", status: 400 };
}
