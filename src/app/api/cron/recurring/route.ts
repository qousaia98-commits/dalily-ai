import { NextResponse } from "next/server";
import { isRecurringServicesEnabled } from "@/lib/config/feature-flags";
import {
  processRecurringReminders,
  processRecurringSchedules,
  optimizeRecurringRoutes,
} from "@/lib/recurring";
import {
  assertCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-auth";

/**
 * Cron: generate upcoming recurring visits + send plan reminders + route hints.
 * Auth: Authorization: Bearer <CRON_SECRET> (fail-closed).
 */
export async function POST(request: Request) {
  const auth = assertCronAuthorized(request);
  if (!auth.ok) return cronUnauthorizedResponse(auth);

  if (!isRecurringServicesEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "flag_off" });
  }

  const schedules = await processRecurringSchedules();
  const reminders = await processRecurringReminders();
  const routes = await optimizeRecurringRoutes();

  return NextResponse.json({
    ok: true,
    schedules,
    reminders,
    routeHints: routes.length,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
