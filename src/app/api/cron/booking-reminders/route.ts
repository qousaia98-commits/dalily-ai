import { NextResponse } from "next/server";
import { processSmartBookingReminders } from "@/lib/booking/smart/reminders";
import { processCompletionPrompts } from "@/lib/booking/completion-service";
import {
  assertCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-auth";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * Cron entry for smart booking reminders (24h / 2h / on-the-way)
 * and optional completion prompts in one pass.
 * Auth: Authorization: Bearer <CRON_SECRET> (fail-closed).
 */
export async function POST(request: Request) {
  return handleApiRoute("cron_booking_reminders", async () => {
    const auth = assertCronAuthorized(request);
    if (!auth.ok) return cronUnauthorizedResponse(auth);

    const reminders = await processSmartBookingReminders();
    const includeCompletion =
      new URL(request.url).searchParams.get("completion") === "1";
    const completion = includeCompletion
      ? await processCompletionPrompts()
      : null;

    return NextResponse.json({ ok: true, reminders, completion });
  });
}

export async function GET(request: Request) {
  return POST(request);
}
