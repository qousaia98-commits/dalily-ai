import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isPaymentWalletEnabled, isPaymentsV2Enabled } from "@/lib/config/feature-flags";
import { getOrCreateWallet, listWalletLedger } from "@/domains/payment/wallet/service";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

/**
 * GET /api/payments/wallet — authenticated wallet balances + recent ledger.
 */
export async function GET() {
  if (!isPaymentsV2Enabled() || !isPaymentWalletEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("payments_wallet", authUser.id), {
    max: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const wallet = await getOrCreateWallet({ userId: authUser.id });
  if (!wallet) {
    return NextResponse.json({ error: "wallet_unavailable" }, { status: 503 });
  }

  const ledger = await listWalletLedger({ userId: authUser.id, limit: 40 });

  return NextResponse.json(
    { wallet, ledger },
    {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    },
  );
}
