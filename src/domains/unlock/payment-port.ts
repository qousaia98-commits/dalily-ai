/**
 * Payment ↔ Unlock correlation types + Sprint 6 implementation.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isUnlockPaymentsV2Enabled } from "@/lib/config/feature-flags";
import { captureUnlockFeePayment } from "@/domains/payment/capture";

export type UnlockPaymentCaptureEvent = {
  unlockSessionId: string;
  paymentRef: string;
  status: "succeeded" | "failed" | "pending";
  capturedAt: string;
};

export interface UnlockPaymentPort {
  getCaptureEvent(
    unlockSessionId: string,
  ): Promise<UnlockPaymentCaptureEvent | null>;
}

export const unlockPaymentPort: UnlockPaymentPort = {
  async getCaptureEvent(unlockSessionId: string) {
    if (!isUnlockPaymentsV2Enabled()) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("payments")
      .select("id, payment_status, payment_reference, paid_at, unlock_session_id")
      .eq("unlock_session_id", unlockSessionId)
      .eq("purpose", "unlock_fee")
      .eq("payment_status", "paid")
      .maybeSingle();
    if (!data) return null;
    return {
      unlockSessionId,
      paymentRef: (data.payment_reference as string) || (data.id as string),
      status: "succeeded" as const,
      capturedAt: (data.paid_at as string) || new Date().toISOString(),
    };
  },
};

/** @deprecated Sprint 5 stub name — use unlockPaymentPort */
export const stubUnlockPaymentPort = unlockPaymentPort;

/**
 * Correlate a verified paid unlock_fee payment → contact grant.
 */
export async function completeUnlockFromPaymentCapture(input: {
  sessionId: string;
  paymentRef: string;
  actorUserId: string;
}): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  if (!isUnlockPaymentsV2Enabled()) {
    return { ok: false, error: "payment_integration_pending" };
  }

  const admin = createAdminClient();
  let payment: { id: string } | null = null;

  const byId = await admin
    .from("payments")
    .select("id")
    .eq("id", input.paymentRef)
    .eq("unlock_session_id", input.sessionId)
    .eq("purpose", "unlock_fee")
    .maybeSingle();
  if (byId.data) {
    payment = byId.data as { id: string };
  } else {
    const byRef = await admin
      .from("payments")
      .select("id")
      .eq("payment_reference", input.paymentRef)
      .eq("unlock_session_id", input.sessionId)
      .eq("purpose", "unlock_fee")
      .maybeSingle();
    payment = (byRef.data as { id: string } | null) ?? null;
  }

  if (!payment) return { ok: false, error: "payment_not_found" };

  const result = await captureUnlockFeePayment({
    paymentId: payment.id,
    actorId: input.actorUserId,
    source: "admin_approval",
    externalEventId: `capture_port:${payment.id}`,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, grantId: result.grantId };
}
