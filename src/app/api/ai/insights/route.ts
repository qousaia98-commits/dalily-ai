import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  isAiAnalyticsEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { getMarketplaceInsightsOverview } from "@/domains/ai";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { canAccessAdminPanel } from "@/lib/auth/roles";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * GET /api/ai/insights — marketplace intelligence overview.
 */
export async function GET() {
  return handleApiRoute("ai_insights", async () => {
    if (!isAiPlatformEnabled() || !isAiAnalyticsEnabled()) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
    }

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "login_required" }, { status: 401 });
    }

    const rate = checkRateLimit(rateLimitKey("ai_insights", authUser.id), {
      max: 40,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const insights = await getMarketplaceInsightsOverview();
    return NextResponse.json({
      insights,
      adminDeepLinks: canAccessAdminPanel(authUser.roles)
        ? [
            "/admin/forecast",
            "/admin/marketplace-intelligence",
            "/admin/ai-ops",
            "/admin/ai-platform",
          ]
        : [],
    });
  });
}
