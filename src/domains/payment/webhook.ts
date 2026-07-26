/**
 * Payment webhook ingestion (Sprint 6 Phase 2).
 * Providers report canonical events; business outcomes live in event-handler.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { recordVerifiedPaymentEvent } from "@/domains/payment/webhook-ledger";
import { isUnlockPaymentsV2Enabled } from "@/lib/config/feature-flags";
import {
  applyCanonicalPaymentEvent,
  normalizePaymentEventType,
} from "@/lib/payment/event-handler";

export type WebhookIngestResult =
  | { ok: true; duplicate: boolean; paymentId?: string; grantId?: string }
  | { ok: false; error: string; status?: number };

function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    if (
      process.env.DALILY_ENV === "production" ||
      process.env.VERCEL_ENV === "production"
    ) {
      return false;
    }
    return process.env.PAYMENT_WEBHOOK_ALLOW_INSECURE === "true";
  }
  const auth = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-dalily-webhook-secret") ?? "";
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

/**
 * Process a provider webhook body.
 * Accepts canonical (payment_succeeded) and legacy dotted (payment.succeeded) types.
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
  const typeRaw = (input.body.type ?? "").trim();
  if (!eventId || !typeRaw) {
    return { ok: false, error: "invalid_payload", status: 400 };
  }

  const canonical = normalizePaymentEventType(typeRaw);
  if (!canonical) {
    return { ok: false, error: "unhandled_event_type", status: 400 };
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
    eventType: canonical,
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
      eventType: canonical,
      forceStatus: "ignored",
      errorMessage: "payment_not_resolved",
    });
    return { ok: false, error: "payment_not_found", status: 404 };
  }

  const actorId = input.body.actorId?.trim() || "webhook";
  const applied = await applyCanonicalPaymentEvent({
    paymentId,
    eventType: canonical,
    actorId,
    externalEventId: eventId,
    source: "webhook",
  });

  if (!applied.ok) {
    await recordVerifiedPaymentEvent({
      provider: input.provider,
      externalEventId: eventId,
      eventType: canonical,
      paymentId,
      forceStatus: "failed",
      errorMessage: applied.error,
    });
    return { ok: false, error: applied.error, status: applied.status ?? 409 };
  }

  // Legacy subscription payments: acknowledge without auto-activate
  if (applied.handled === "legacy") {
    await recordVerifiedPaymentEvent({
      provider: input.provider,
      externalEventId: eventId,
      eventType: canonical,
      paymentId,
      forceStatus: "ignored",
      errorMessage: "legacy_subscription_requires_admin_rail",
    });
    return { ok: true, duplicate: false, paymentId };
  }

  await recordVerifiedPaymentEvent({
    provider: input.provider,
    externalEventId: eventId,
    eventType: canonical,
    paymentId,
    forceStatus: "processed",
  });

  return {
    ok: true,
    duplicate: applied.duplicate,
    paymentId: applied.paymentId,
    grantId: applied.grantId,
  };
}
