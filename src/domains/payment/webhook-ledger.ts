/**
 * Idempotent ledger for payment webhooks / verified server events.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";

export type LedgerResult = {
  status: "inserted" | "duplicate_processed" | "duplicate_received" | "updated";
  eventId: string;
};

/** Minimal Supabase-like client surface used by the webhook ledger. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WebhookLedgerClient = any;

export async function recordVerifiedPaymentEvent(
  input: {
    provider: string;
    externalEventId: string;
    eventType: string;
    paymentId?: string | null;
    payload?: Record<string, unknown>;
    forceStatus?: "received" | "processed" | "ignored" | "failed";
    errorMessage?: string | null;
  },
  client: WebhookLedgerClient = createAdminClient(),
): Promise<LedgerResult> {
  const payloadJson = (input.payload ?? {}) as Json;

  const { data: existing } = await client
    .from("payment_webhook_events")
    .select("id, processing_status")
    .eq("provider", input.provider)
    .eq("external_event_id", input.externalEventId)
    .maybeSingle();

  if (existing) {
    if (input.forceStatus) {
      await client
        .from("payment_webhook_events")
        .update({
          processing_status: input.forceStatus,
          payment_id: input.paymentId ?? null,
          error_message: input.errorMessage ?? null,
          processed_at:
            input.forceStatus === "processed" || input.forceStatus === "ignored"
              ? new Date().toISOString()
              : null,
          payload: payloadJson,
        })
        .eq("id", existing.id);
      return { status: "updated", eventId: existing.id as string };
    }
    if (existing.processing_status === "processed") {
      return { status: "duplicate_processed", eventId: existing.id as string };
    }
    return { status: "duplicate_received", eventId: existing.id as string };
  }

  const { data: inserted, error } = await client
    .from("payment_webhook_events")
    .insert({
      provider: input.provider,
      external_event_id: input.externalEventId,
      event_type: input.eventType,
      payload: payloadJson,
      processing_status: input.forceStatus ?? "received",
      payment_id: input.paymentId ?? null,
      error_message: input.errorMessage ?? null,
      processed_at:
        input.forceStatus === "processed" || input.forceStatus === "ignored"
          ? new Date().toISOString()
          : null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // Unique race — re-read
    const { data: again } = await client
      .from("payment_webhook_events")
      .select("id, processing_status")
      .eq("provider", input.provider)
      .eq("external_event_id", input.externalEventId)
      .maybeSingle();
    if (again?.processing_status === "processed") {
      return { status: "duplicate_processed", eventId: again.id as string };
    }
    if (again) return { status: "duplicate_received", eventId: again.id as string };
    throw new Error(error?.message ?? "webhook_ledger_insert_failed");
  }

  return { status: "inserted", eventId: inserted.id as string };
}
