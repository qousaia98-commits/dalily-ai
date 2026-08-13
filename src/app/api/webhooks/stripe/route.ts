import { NextResponse } from "next/server";
import {
  getStripe,
  getStripeWebhookSecret,
  isStripeConfigured,
} from "@/lib/payment/stripe/client";
import { processStripeEvent } from "@/lib/payment/stripe/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Stripe webhook endpoint — signature verified, then mapped to canonical events.
 * Configure in Stripe Dashboard: POST /api/webhooks/stripe
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const secret = getStripeWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "stripe_webhook_secret_missing" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    try {
      await admin.from("payment_webhook_events").insert({
        provider: "stripe",
        external_event_id: `invalid_sig_${Date.now()}`,
        event_type: "signature_invalid",
        payload: {},
        processing_status: "failed",
        error_message: "invalid_signature",
        signature_valid: false,
      });
    } catch {
      // soft
    }
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const result = await processStripeEvent(event);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    duplicate: Boolean(result.duplicate),
    paymentId: result.paymentId,
  });
}
