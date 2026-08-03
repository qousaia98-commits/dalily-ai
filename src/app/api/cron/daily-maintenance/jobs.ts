import { processCompletionPrompts } from "@/lib/booking/completion-service";
import { processSmartBookingReminders } from "@/lib/booking/smart/reminders";
import { resetMonthlyIncludedUnlocks } from "@/lib/monetization";
import {
  processRecurringReminders,
  processRecurringSchedules,
  optimizeRecurringRoutes,
} from "@/lib/recurring";
import { processUnlockSlaTimeouts } from "@/domains/unlock/fallback";
import { cleanupExpiredMobileBridgeCodes } from "@/lib/auth/mobile-bridge";
import {
  isProviderMonetizationEnabled,
  isRecurringServicesEnabled,
  isUnlockV2Enabled,
} from "@/lib/config/feature-flags";
import { logger } from "@/lib/observability/logger";

type JobStatus = "ok" | "error" | "skipped";

export type DailyMaintenanceJobResult = {
  job: string;
  status: JobStatus;
  durationMs: number;
  result?: unknown;
  error?: string;
  reason?: string;
};

async function runJob(
  job: string,
  fn: () => Promise<unknown>,
): Promise<DailyMaintenanceJobResult> {
  const started = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - started;
    logger.info("cron_daily_maintenance", "job_ok", { job, durationMs });
    return { job, status: "ok", durationMs, result };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "unknown";
    logger.error("cron_daily_maintenance", "job_failed", {
      job,
      durationMs,
      error: message,
    });
    return { job, status: "error", durationMs, error: message };
  }
}

function skippedJob(job: string, reason: string): DailyMaintenanceJobResult {
  logger.info("cron_daily_maintenance", "job_skipped", { job, reason });
  return { job, status: "skipped", durationMs: 0, reason };
}

/**
 * Hobby-plan aggregator: runs all daily maintenance tasks in one invocation.
 * Individual routes remain for on-demand / future higher-frequency schedules.
 *
 * Dedupes processCompletionPrompts: booking-reminders only calls it with
 * ?completion=1, so the aggregator runs completion once via booking-completion
 * and reminders without the optional completion pass.
 */
export async function runDailyMaintenanceJobs(): Promise<
  DailyMaintenanceJobResult[]
> {
  const jobs: DailyMaintenanceJobResult[] = [];

  jobs.push(await runJob("booking-completion", () => processCompletionPrompts()));

  jobs.push(
    await runJob("booking-reminders", () => processSmartBookingReminders()),
  );

  if (!isProviderMonetizationEnabled()) {
    jobs.push(skippedJob("monetization-reset", "flag_off"));
  } else {
    jobs.push(
      await runJob("monetization-reset", () => resetMonthlyIncludedUnlocks()),
    );
  }

  if (!isRecurringServicesEnabled()) {
    jobs.push(skippedJob("recurring-schedules", "flag_off"));
    jobs.push(skippedJob("recurring-reminders", "flag_off"));
    jobs.push(skippedJob("recurring-routes", "flag_off"));
  } else {
    jobs.push(
      await runJob("recurring-schedules", () => processRecurringSchedules()),
    );
    jobs.push(
      await runJob("recurring-reminders", () => processRecurringReminders()),
    );
    jobs.push(
      await runJob("recurring-routes", () => optimizeRecurringRoutes()),
    );
  }

  if (!isUnlockV2Enabled()) {
    jobs.push(skippedJob("unlock-sla", "flag_off"));
  } else {
    jobs.push(await runJob("unlock-sla", () => processUnlockSlaTimeouts()));
  }

  jobs.push(
    await runJob("mobile-bridge-cleanup", () =>
      cleanupExpiredMobileBridgeCodes(),
    ),
  );

  return jobs;
}
