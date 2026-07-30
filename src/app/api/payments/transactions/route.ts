import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isPaymentsV2Enabled } from "@/lib/config/feature-flags";
import { listUserPaymentHistory, getPaymentStatus } from "@/domains/payment/transactions/service";
import { canAccessPayment } from "@/domains/payment/authz";
import { getOwnedProvider } from "@/lib/providers/database";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

/**
 * GET /api/payments/transactions — payment / escrow / ledger history.
 * Optional ?paymentId= for single status (ownership required).
 */
export async function GET(request: Request) {
  if (!isPaymentsV2Enabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("payments_tx", authUser.id), {
    max: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("paymentId");
  if (paymentId) {
    const allowed = await canAccessPayment({
      paymentId,
      userId: authUser.id,
      roles: authUser.roles,
    });
    if (!allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const payment = await getPaymentStatus(paymentId);
    if (!payment) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ payment });
  }

  const provider = await getOwnedProvider(authUser.id);
  const limit = Math.min(Number(searchParams.get("limit") ?? 40) || 40, 100);
  const history = await listUserPaymentHistory({
    userId: authUser.id,
    providerId: provider?.id ?? null,
    limit,
  });

  return NextResponse.json(
    { history },
    {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    },
  );
}
