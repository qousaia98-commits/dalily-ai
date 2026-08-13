import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isAiPlatformEnabled } from "@/lib/config/feature-flags";
import { getAiAdminCenterOverview } from "@/domains/ai";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { canAccessAdminPanel } from "@/lib/auth/roles";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * GET /api/ai/admin — admin AI platform dashboard payload.
 */
export async function GET() {
  return handleApiRoute("ai_admin", async () => {
    if (!isAiPlatformEnabled()) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
    }

    const authUser = await getAuthUser();
    if (!authUser || !canAccessAdminPanel(authUser.roles)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const rate = checkRateLimit(rateLimitKey("ai_admin", authUser.id), {
      max: 40,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const overview = await getAiAdminCenterOverview();
    return NextResponse.json(
      { overview },
      {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
        },
      },
    );
  });
}
