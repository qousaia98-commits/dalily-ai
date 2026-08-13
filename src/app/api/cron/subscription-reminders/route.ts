import { NextResponse } from "next/server";
import { processSubscriptionReminders } from "@/lib/monetization/subscription-reminders";
import {
  assertCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-auth";
import { handleApiRoute } from "@/lib/observability/api-route";

/**
 * Cron: subscription expiry + grace reminders (flat $5/mo model).
 * Prefer folding via /api/cron/daily-maintenance on Hobby; this route stays
 * for on-demand / future schedules.
 * Auth: Authorization: Bearer <CRON_SECRET> (fail-closed).
 */
export async function POST(request: Request) {
  return handleApiRoute("cron_subscription_reminders", async () => {
    const auth = assertCronAuthorized(request);
    if (!auth.ok) return cronUnauthorizedResponse(auth);

    const result = await processSubscriptionReminders();
    return NextResponse.json({ ok: true, ...result });
  });
}

export async function GET(request: Request) {
  return POST(request);
}
