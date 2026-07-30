import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { isAiPlatformEnabled } from "@/lib/config/feature-flags";
import { getAiPlatformStatus, getAiPlatformHealth } from "@/domains/ai";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { canAccessAdminPanel } from "@/lib/auth/roles";

/**
 * GET /api/ai/status — platform flags + provider health (auth required).
 */
export async function GET() {
  if (!isAiPlatformEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rate = checkRateLimit(rateLimitKey("ai_status", authUser.id), {
    max: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const status = await getAiPlatformStatus();
  const includeHealth = canAccessAdminPanel(authUser.roles);
  const health = includeHealth ? await getAiPlatformHealth() : null;

  return NextResponse.json(
    { status, health },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    },
  );
}
