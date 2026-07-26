import { NextResponse } from "next/server";
import { isRecurringServicesEnabled } from "@/lib/config/feature-flags";
import {
  processRecurringReminders,
  processRecurringSchedules,
  optimizeRecurringRoutes,
} from "@/lib/recurring";

/**
 * Cron: generate upcoming recurring visits + send plan reminders + route hints.
 * Protect with CRON_SECRET: Authorization: Bearer <secret>
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

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
