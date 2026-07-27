/**
 * Smart gap filling — detect 30–180 minute gaps without creating conflicts.
 */

import type { ScheduleGap, ScheduleStop } from "@/lib/scheduling-engine/types";

export function detectScheduleGaps(
  stops: ScheduleStop[],
  opts?: { minMinutes?: number; maxMinutes?: number },
): ScheduleGap[] {
  const minM = opts?.minMinutes ?? 30;
  const maxM = opts?.maxMinutes ?? 180;
  const ordered = [...stops].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const gaps: ScheduleGap[] = [];

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const next = ordered[i];
    const duration =
      (new Date(next.startsAt).getTime() - new Date(prev.endsAt).getTime()) /
      60_000;
    if (duration >= minM && duration <= maxM) {
      gaps.push({
        startsAt: prev.endsAt,
        endsAt: next.startsAt,
        durationMinutes: Math.round(duration),
      });
    }
  }

  return gaps;
}

export function totalIdleMinutes(gaps: ScheduleGap[]): number {
  return gaps.reduce((a, g) => a + g.durationMinutes, 0);
}

/**
 * Check whether a candidate job fits a gap with travel buffers (no conflict).
 */
export function fitsGapWithoutConflict(input: {
  gap: ScheduleGap;
  jobDurationMin: number;
  travelInMin: number;
  travelOutMin: number;
  bufferMin?: number;
}): boolean {
  const buffer = input.bufferMin ?? 10;
  const needed =
    input.travelInMin + input.jobDurationMin + input.travelOutMin + buffer;
  return needed <= input.gap.durationMinutes;
}
