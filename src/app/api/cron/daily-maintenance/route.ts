import { NextResponse } from "next/server";
import {
  assertCronAuthorized,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-auth";
import { handleApiRoute } from "@/lib/observability/api-route";
import { logger } from "@/lib/observability/logger";
import { runDailyMaintenanceJobs } from "./jobs";

/**
 * Cron / Vercel scheduler entry for once-daily maintenance.
 * Auth: Authorization: Bearer <CRON_SECRET> (fail-closed).
 */
export async function POST(request: Request) {
  return handleApiRoute("cron_daily_maintenance", async () => {
    const auth = assertCronAuthorized(request);
    if (!auth.ok) return cronUnauthorizedResponse(auth);

    const started = Date.now();
    const jobs = await runDailyMaintenanceJobs();
    const failed = jobs.filter((j) => j.status === "error").length;

    logger.info("cron_daily_maintenance", "run_complete", {
      durationMs: Date.now() - started,
      jobCount: jobs.length,
      failed,
    });

    return NextResponse.json({
      ok: failed === 0,
      durationMs: Date.now() - started,
      jobs,
    });
  });
}

export async function GET(request: Request) {
  return POST(request);
}
