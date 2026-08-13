import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isAiPlatformEnabled,
  isAiPricingEnabled,
} from "@/lib/config/feature-flags";
import { estimatePriceRange } from "@/domains/ai";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

/**
 * POST /api/ai/pricing — advisory price range only.
 */
export async function POST(request: Request) {
  if (!isAiPlatformEnabled() || !isAiPricingEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("ai_pricing", authUser.id), {
    max: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    categoryKey?: string;
    regionKey?: string;
    complexity01?: number;
    urgency01?: number;
    currency?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.categoryKey?.trim()) {
    return NextResponse.json({ error: "category_required" }, { status: 400 });
  }

  const estimate = await estimatePriceRange({
    categoryKey: body.categoryKey.trim(),
    regionKey: body.regionKey,
    complexity01: body.complexity01,
    urgency01: body.urgency01,
    currency: body.currency,
    customerId: authUser.id,
  });

  if (!estimate) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({ estimate, advisoryOnly: true });
}
