/**
 * Sprint 6 Phase 2 — lead unlock payment records.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function recordLeadUnlockPayment(input: {
  paymentId: string;
  unlockSessionId: string;
  serviceRequestId?: string | null;
  providerId: string;
  aiPriceUsd?: number | null;
  aiScore?: number | null;
  pricingHistoryId?: string | null;
  currency?: string;
  paymentReference?: string | null;
}): Promise<void> {
  try {
    await db().from("lead_unlock_payments").upsert(
      {
        payment_id: input.paymentId,
        unlock_session_id: input.unlockSessionId,
        service_request_id: input.serviceRequestId ?? null,
        provider_id: input.providerId,
        ai_price_usd: input.aiPriceUsd ?? null,
        ai_score: input.aiScore ?? null,
        pricing_history_id: input.pricingHistoryId ?? null,
        currency: input.currency ?? "USD",
        payment_reference: input.paymentReference ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" },
    );
    void emitAiLearningEvent({
      eventType: "lead_payment_recorded",
      providerId: input.providerId,
      serviceRequestId: input.serviceRequestId,
      metadata: { anonymized: true, paymentId: input.paymentId },
    });
  } catch {
    // soft
  }
}

export async function markLeadUnlockGranted(input: {
  paymentId: string;
}): Promise<void> {
  try {
    await db()
      .from("lead_unlock_payments")
      .update({
        unlock_granted: true,
        unlocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("payment_id", input.paymentId);
  } catch {
    // soft
  }
}
