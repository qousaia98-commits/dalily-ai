import { NextResponse } from "next/server";
import { cleanupExpiredMobileBridgeCodes } from "@/lib/auth/mobile-bridge";
import {
  assertCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-auth";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * Cron: delete expired mobile WebView bridge codes.
 * Auth: Authorization: Bearer <CRON_SECRET> (fail-closed).
 */
export async function POST(request: Request) {
  return handleApiRoute("cron_mobile_bridge_cleanup", async () => {
    const auth = assertCronAuthorized(request);
    if (!auth.ok) return cronUnauthorizedResponse(auth);

    const deleted = await cleanupExpiredMobileBridgeCodes();
    return NextResponse.json({ ok: true, deleted });
  });
}

export async function GET(request: Request) {
  return POST(request);
}
