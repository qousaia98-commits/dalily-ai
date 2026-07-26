import { NextResponse } from "next/server";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import { resetMonthlyIncludedUnlocks } from "@/lib/monetization";
import { logger } from "@/lib/observability/logger";

/**
 * Cron: reset Business included unlocks for the current UTC month.
 * Unused unlocks do NOT carry over.
 * Auth: Authorization: Bearer <CRON_SECRET> when set.
 */
export async function POST(request: Request) {
  if (!isProviderMonetizationEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "flag_off" });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
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
