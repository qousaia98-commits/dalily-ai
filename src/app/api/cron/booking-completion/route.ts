import { NextResponse } from "next/server";
import { processCompletionPrompts } from "@/lib/booking/completion-service";
import {
  assertCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-auth";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * Cron / external scheduler entry for completion prompts.
 * Auth: Authorization: Bearer <CRON_SECRET> (fail-closed).
 */
export async function POST(request: Request) {
  return handleApiRoute("cron_booking_completion", async () => {
    const auth = assertCronAuthorized(request);
    if (!auth.ok) return cronUnauthorizedResponse(auth);

    const result = await processCompletionPrompts();
    return NextResponse.json({ ok: true, ...result });
  });
}

export async function GET(request: Request) {
  return POST(request);
}
