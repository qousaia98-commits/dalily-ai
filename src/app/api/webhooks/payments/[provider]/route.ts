import { NextResponse } from "next/server";
import { ingestPaymentWebhook } from "@/domains/payment/webhook";

type RouteContext = { params: Promise<{ provider: string }> };

/**
 * Verified server-side payment webhook.
 * Never trust client payment state — confirmation only via this route or admin approval.
 *
 * Auth: Authorization: Bearer $PAYMENT_WEBHOOK_SECRET
 *    or: x-dalily-webhook-secret: $PAYMENT_WEBHOOK_SECRET
 *
 * Body: { eventId, type, paymentId?, paymentReference?, actorId? }
 * Types: payment.succeeded | payment.failed | payment.cancelled
 */
export async function POST(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const safeProvider = (provider || "unknown").slice(0, 40).toLowerCase();

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await ingestPaymentWebhook({
    request,
    provider: safeProvider,
    body: {
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
      type: typeof body.type === "string" ? body.type : undefined,
      paymentId: typeof body.paymentId === "string" ? body.paymentId : undefined,
      paymentReference:
        typeof body.paymentReference === "string" ? body.paymentReference : undefined,
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status ?? 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    paymentId: result.paymentId,
    grantId: result.grantId,
  });
}
