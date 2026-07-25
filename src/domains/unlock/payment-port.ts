/**
 * Payment ↔ Unlock correlation port (Sprint 5 stub).
 * Real charge + capture correlation lands in Sprint 6.
 * Unlock success without a payment event must fail closed except
 * UNLOCK_DEV_BYPASS / audited admin manual_confirm.
 */

export type UnlockPaymentCaptureEvent = {
  unlockSessionId: string;
  paymentRef: string;
  status: "succeeded" | "failed" | "pending";
  capturedAt: string;
};

/**
 * Port that Payment Integration (Sprint 6) will implement.
 * Sprint 5 returns null — no fake payment success.
 */
export interface UnlockPaymentPort {
  getCaptureEvent(
    unlockSessionId: string,
  ): Promise<UnlockPaymentCaptureEvent | null>;
}

export const stubUnlockPaymentPort: UnlockPaymentPort = {
  async getCaptureEvent() {
    return null;
  },
};

/**
 * Sprint 6 entry: correlate payment success → unlock grant.
 * Fail-closed until Payment Integration wires a real capture.
 */
export async function completeUnlockFromPaymentCapture(_input: {
  sessionId: string;
  paymentRef: string;
  actorUserId: string;
}): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  void _input;
  return { ok: false, error: "payment_integration_pending" };
}
