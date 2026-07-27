/**
 * Capacity management snapshot from bookings + provider_capacity.
 */

import type { CapacitySnapshot, ScheduleRawSignals } from "@/lib/scheduling-engine/types";

export function computeCapacitySnapshot(
  raw: ScheduleRawSignals,
): CapacitySnapshot {
  const jobsBooked = Math.max(raw.jobsToday, raw.stops.length);
  const remaining = Math.max(0, raw.maxDailyJobs - jobsBooked);
  const available =
    raw.vacationMode || raw.pauseMode ? 0 : remaining;
  const overbookingRisk =
    jobsBooked >= raw.maxDailyJobs
      ? 0.95
      : jobsBooked / Math.max(1, raw.maxDailyJobs);
  const burnoutRisk = Math.min(
    0.95,
    Math.max(raw.fatigue01, overbookingRisk * 0.7 + raw.stops.length * 0.05),
  );
  const workloadScore = Math.min(
    1,
    jobsBooked / Math.max(1, raw.maxDailyJobs),
  );

  return {
    maxDailyJobs: raw.maxDailyJobs,
    maxWeeklyJobs: raw.maxWeeklyJobs,
    jobsBooked,
    remainingCapacity: remaining,
    availableCapacity: available,
    overbookingRisk: Math.round(overbookingRisk * 1000) / 1000,
    burnoutRisk: Math.round(burnoutRisk * 1000) / 1000,
    vacationMode: raw.vacationMode,
    pauseMode: raw.pauseMode,
    workloadScore: Math.round(workloadScore * 1000) / 1000,
  };
}
