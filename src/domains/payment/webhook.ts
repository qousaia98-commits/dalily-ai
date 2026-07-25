/**
 * Payment webhook ingestion (Sprint 6).
 * All confirmation must come from verified server-side events — never the client.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { captureUnlockFeePayment } from "@/domains/payment/capture";
import { markUnlockFeePaymentFailed } from "@/domains/payment/unlock-fee";
import { recordVerifiedPaymentEvent } from "@/domains/payment/webhook-ledger";
import { isUnlockPaymentsV2Enabled } from "@/lib/config/feature-flags";

export type WebhookIngestResult =
  | { ok: true; duplicate: boolean; paymentId?: string; grantId?: string }
  | { ok: false; error: string; status?: number };

function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed when secret unset in production-like envs
    if (
      process.env.DALILY_ENV === "production" ||
      process.env.VERCEL_ENV === "production"
    ) {
      return false;
    }
    // Local/dev: allow only when explicitly opted in
    return process.env.PAYMENT_WEBHOOK_ALLOW_INSECURE === "true";
  }
  const auth = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-dalily-webhook-secret") ?? "";
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

/**
 * Process a provider webhook body.
 * Supported event types: payment.succeeded | payment.failed | payment.cancelled
 */
export async function ingestPaymentWebhook(input: {
  request: Request;
  provider: string;
  body: {
    eventId?: string;
    type?: string;
    paymentId?: string;
    paymentReference?: string;
    actorId?: string;
  };
}): Promise<WebhookIngestResult> {
  if (!isUnlockPaymentsV2Enabled()) {
    return { ok: false, error: "feature_disabled", status: 503 };
  }
  if (!verifyWebhookSecret(input.request)) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  const eventId = (input.body.eventId ?? "").trim();
  const type = (input.body.type ?? "").trim();
  if (!eventId || !type) {
    return { ok: false, error: "invalid_payload", status: 400 };
  }

  const admin = createAdminClient();
  let paymentId = input.body.paymentId?.trim() || null;

  if (!paymentId && input.body.paymentReference) {
    const { data } = await admin
      .from("payments")
      .select("id")
      .eq("payment_reference", input.body.paymentReference.trim())
      .maybeSingle();
    paymentId = (data?.id as string) ?? null;
  }

  const ledger = await recordVerifiedPaymentEvent({
    provider: input.provider,
    externalEventId: eventId,
    eventType: type,
    paymentId,
    payload: input.body as Record<string, unknown>,
  });

  if (ledger.status === "duplicate_processed") {
    return { ok: true, duplicate: true, paymentId: paymentId ?? undefined };
  }

  if (!paymentId) {
    await recordVerifiedPaymentEvent({
      provider: input.provider,
      externalEventId: eventId,
      eventType: type,
      forceStatus: "ignored",
      errorMessage: "payment_not_resolved",
    });
    return { ok: false, error: "payment_not_found", status: 404 };
  }

  const { data: payment } = await admin
    .from("payments")
    .select("id, purpose, payment_status")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) {
    return { ok: false, error: "payment_not_found", status: 404 };
  }

  // Subscription webhooks: acknowledge but do not auto-activate (admin rail remains)
  if (payment.purpose !== "unlock_fee") {
    await recordVerifiedPaymentEvent({
      provider: input.provider,
      externalEventId: eventId,
      eventType: type,
      paymentId,
      forceStatus: "ignored",
      errorMessage: "subscription_requires_admin_rail",
    });
    return { ok: true, duplicate: false, paymentId };
  }

  const actorId = input.body.actorId?.trim() || "webhook";

  if (type === "payment.succeeded") {
    const captured = await captureUnlockFeePayment({
      paymentId,
      actorId,
      source: "webhook",
      externalEventId: eventId,
    });
    if (!captured.ok) {
      await recordVerifiedPaymentEvent({
        provider: input.provider,
        externalEventId: eventId,
        eventType: type,
        paymentId,
        forceStatus: "failed",
        errorMessage: captured.error,
      });
      return { ok: false, error: captured.error, status: 409 };
    }
    return {
      ok: true,
      duplicate: captured.alreadyCaptured,
      paymentId: captured.paymentId,
      grantId: captured.grantId,
    };
  }

  if (type === "payment.failed") {
    await markUnlockFeePaymentFailed({
      paymentId,
      actorId,
      note: "webhook:payment.failed",
    });
    await recordVerifiedPaymentEvent({
      provider: input.provider,
      externalEventId: eventId,
      eventType: type,
      paymentId,
      forceStatus: "processed",
    });
    return { ok: true, duplicate: false, paymentId };
  }

  if (type === "payment.cancelled") {
    if (payment.payment_status === "pending") {
      await admin
        .from("payments")
        .update({ payment_status: "cancelled" })
        .eq("id", paymentId)
        .eq("payment_status", "pending");
    }
    await recordVerifiedPaymentEvent({
      provider: input.provider,
      externalEventId: eventId,
      eventType: type,
      paymentId,
      forceStatus: "processed",
    });
    return { ok: true, duplicate: false, paymentId };
  }

  await recordVerifiedPaymentEvent({
    provider: input.provider,
    externalEventId: eventId,
    eventType: type,
    paymentId,
    forceStatus: "ignored",
    errorMessage: "unhandled_event_type",
  });
  return { ok: true, duplicate: false, paymentId };
}
