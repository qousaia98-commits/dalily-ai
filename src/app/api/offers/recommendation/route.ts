import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isOfferDecisionEngineEnabled } from "@/lib/config/feature-flags";
import { listOffersForRequest } from "@/domains/offer/create-offer";
import { loadOfferDecisionBoardForCustomer } from "@/domains/offer/recommendation";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { getRequestDetail } from "@/lib/service-requests/queries";

/**
 * Authenticated offer recommendation board (public DTO only).
 * Never returns weights, formulas, or private performance fields.
 */
export async function GET(request: Request) {
  if (!isOfferDecisionEngineEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("offer_decision_api", authUser.id), {
    max: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: rate.retryAfterMs },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const detail = await getRequestDetail(requestId);
  if (!detail || detail.customer_id !== authUser.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const offers = await listOffersForRequest(requestId, {
    customerId: authUser.id,
  });
  const board = await loadOfferDecisionBoardForCustomer({
    requestId,
    customerId: authUser.id,
    offers,
  });

  if (!board) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }

  return NextResponse.json(
    { board },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    },
  );
}
