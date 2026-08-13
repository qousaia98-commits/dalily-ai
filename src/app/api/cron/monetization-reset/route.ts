import { NextResponse } from "next/server";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import { resetMonthlyIncludedUnlocks } from "@/lib/monetization";
import { logger } from "@/lib/observability/logger";
import {
  assertCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-auth";

/**
 * Cron: reset Business included unlocks for the current UTC month.
 * Unused unlocks do NOT carry over.
 * Auth: Authorization: Bearer <CRON_SECRET> (fail-closed).
 */
export async function POST(request: Request) {
  const auth = assertCronAuthorized(request);
  if (!auth.ok) return cronUnauthorizedResponse(auth);

  if (!isProviderMonetizationEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "flag_off" });
  }

  try {
    const result = await resetMonthlyIncludedUnlocks();
    logger.info("monetization_cron", "included_unlocks_reset", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("monetization_cron", "reset_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "reset_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
