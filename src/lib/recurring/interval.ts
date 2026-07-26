/**
 * Interval helpers for recurring plans.
 */

import type { RecurringIntervalKind } from "./types";

export function intervalToDays(
  kind: RecurringIntervalKind,
  customDays?: number | null,
): number {
  switch (kind) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "semiannual":
      return 182;
    case "yearly":
      return 365;
    case "custom":
      return Math.max(1, customDays ?? 30);
  }
}

/**
 * Advance from a date by interval, snapping to preferred weekday when set.
 */
export function nextOccurrence(input: {
  from: Date;
  intervalKind: RecurringIntervalKind;
  customIntervalDays?: number | null;
  preferredWeekdays?: number[];
  preferredHour?: number;
  preferredMinute?: number;
}): Date {
  const days = intervalToDays(input.intervalKind, input.customIntervalDays);
  const next = new Date(input.from.getTime() + days * 86_400_000);

  const weekdays = input.preferredWeekdays?.filter((d) => d >= 0 && d <= 6) ?? [];
  if (weekdays.length > 0) {
    for (let i = 0; i < 14; i++) {
      const candidate = new Date(next.getTime() + i * 86_400_000);
      if (weekdays.includes(candidate.getDay())) {
        candidate.setHours(
          input.preferredHour ?? 10,
          input.preferredMinute ?? 0,
          0,
          0,
        );
        return candidate;
      }
    }
  }

  next.setHours(input.preferredHour ?? 10, input.preferredMinute ?? 0, 0, 0);
  return next;
}

export function parseTimeParts(
  time: string | null | undefined,
): { hour: number; minute: number } {
  if (!time) return { hour: 10, minute: 0 };
  const [h, m] = time.split(":").map((x) => Number(x));
  return {
    hour: Number.isFinite(h) ? h : 10,
    minute: Number.isFinite(m) ? m : 0,
  };
}
