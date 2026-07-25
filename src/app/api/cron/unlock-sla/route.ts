import { NextResponse } from "next/server";
import { processUnlockSlaTimeouts } from "@/domains/unlock/fallback";
import { isUnlockV2Enabled } from "@/lib/config/feature-flags";

/**
 * Cron entry for unlock SLA timeouts + idempotent fallback.
 * Protect with CRON_SECRET when set: Authorization: Bearer <secret>
 */
export async function POST(request: Request) {
  if (!isUnlockV2Enabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "flag_off" });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await processUnlockSlaTimeouts();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
