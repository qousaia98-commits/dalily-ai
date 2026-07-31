import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isAiPlatformEnabled } from "@/lib/config/feature-flags";
import { getMatchingPublicApi } from "@/domains/ai/matching/service";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * GET /api/ai/recommendations — matching / offer decision status bridge.
 * Weights stay server-side; use /api/offers/recommendation for offer boards.
 */
export async function GET() {
  return handleApiRoute("ai_recommendations", async () => {
    if (!isAiPlatformEnabled()) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
    }

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "login_required" }, { status: 401 });
    }

    const rate = checkRateLimit(rateLimitKey("ai_recommendations", authUser.id), {
      max: 40,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const matching = await getMatchingPublicApi();
    return NextResponse.json({
      matching,
      offerRecommendationApi: "/api/offers/recommendation",
      advisoryOnly: true,
      weightsHidden: true,
    });
  });
}
