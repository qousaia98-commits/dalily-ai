import { NextResponse } from "next/server";
import { processUnlockSlaTimeouts } from "@/domains/unlock/fallback";
import { isUnlockV2Enabled } from "@/lib/config/feature-flags";
import {
  assertCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-auth";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * Cron entry for unlock SLA timeouts + idempotent fallback.
 * Auth: Authorization: Bearer <CRON_SECRET> (fail-closed).
 */
export async function POST(request: Request) {
  return handleApiRoute("cron_unlock_sla", async () => {
    const auth = assertCronAuthorized(request);
    if (!auth.ok) return cronUnauthorizedResponse(auth);

    if (!isUnlockV2Enabled()) {
      return NextResponse.json({ ok: true, skipped: true, reason: "flag_off" });
    }

    const result = await processUnlockSlaTimeouts();
    return NextResponse.json({ ok: true, ...result });
  });
}

export async function GET(request: Request) {
  return POST(request);
}
