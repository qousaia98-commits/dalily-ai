import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isPayoutsEnabled, isPaymentsV2Enabled } from "@/lib/config/feature-flags";
import { listPayouts, getPayoutById } from "@/domains/payment/payouts/engine";
import { getOwnedProvider } from "@/lib/providers/database";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { canManageFinance } from "@/lib/auth/roles";

/**
 * GET /api/payments/payouts — provider payout status / history.
 */
export async function GET(request: Request) {
  if (!isPaymentsV2Enabled() || !isPayoutsEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("payments_payouts", authUser.id), {
    max: 40,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const isFinance = canManageFinance(authUser.roles);
  const { searchParams } = new URL(request.url);
  const payoutId = searchParams.get("payoutId");
  if (payoutId) {
    const payout = await getPayoutById(payoutId);
    if (!payout) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const provider = await getOwnedProvider(authUser.id);
    if (!isFinance && provider?.id !== payout.providerId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ payout });
  }

  const provider = await getOwnedProvider(authUser.id);
  if (!provider && !isFinance) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payouts = await listPayouts({
    providerId: isFinance && !provider ? undefined : provider?.id,
    ownerUserId: provider ? undefined : isFinance ? undefined : authUser.id,
    limit: 50,
  });

  return NextResponse.json(
    { payouts },
    {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    },
  );
}
