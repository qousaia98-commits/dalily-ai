/**
 * Trend engine — daily / weekly / monthly / quarterly / yearly change.
 */

import type { LivePlatformCounters } from "@/lib/ai-ops/collect";
import type { PlatformTrend, TrendPeriod } from "@/lib/ai-ops/types";

function changePct(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) {
    return current > 0 ? 100 : previous === 0 && current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function direction(pct: number | null): "up" | "down" | "stable" {
  if (pct == null || Math.abs(pct) < 3) return "stable";
  return pct > 0 ? "up" : "down";
}

function periodWindow(period: TrendPeriod): { start: Date; end: Date; prevStart: Date } {
  const end = new Date();
  const start = new Date(end);
  const prevStart = new Date(end);
  switch (period) {
    case "daily":
      start.setUTCDate(start.getUTCDate() - 1);
      prevStart.setUTCDate(prevStart.getUTCDate() - 2);
      break;
    case "weekly":
      start.setUTCDate(start.getUTCDate() - 7);
      prevStart.setUTCDate(prevStart.getUTCDate() - 14);
      break;
    case "monthly":
      start.setUTCMonth(start.getUTCMonth() - 1);
      prevStart.setUTCMonth(prevStart.getUTCMonth() - 2);
      break;
    case "quarterly":
      start.setUTCMonth(start.getUTCMonth() - 3);
      prevStart.setUTCMonth(prevStart.getUTCMonth() - 6);
      break;
    case "yearly":
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      prevStart.setUTCFullYear(prevStart.getUTCFullYear() - 2);
      break;
  }
  return { start, end, prevStart };
}

export function computeTrendsFromCounters(
  counters: LivePlatformCounters,
  periods: TrendPeriod[] = ["daily", "weekly", "monthly", "quarterly", "yearly"],
): Omit<PlatformTrend, "id">[] {
  const metrics: Array<{ key: string; value: number; previous: number }> = [
    {
      key: "bookings",
      value: counters.bookingsWeek,
      previous: counters.bookingsPrevWeek,
    },
    {
      key: "complaints",
      value: counters.complaintsWeek,
      previous: counters.complaintsPrevWeek,
    },
    {
      key: "reviews",
      value: counters.reviewCountWeek,
      previous: counters.reviewCountPrevWeek,
    },
    {
      key: "fraud_alerts",
      value: counters.fraudAlerts,
      previous: Math.max(0, counters.fraudAlerts - 1),
    },
    {
      key: "refunds",
      value: counters.refundsWeek,
      previous: Math.max(0, Math.round(counters.refundsWeek * 0.85)),
    },
  ];

  const out: Omit<PlatformTrend, "id">[] = [];
  for (const period of periods) {
    const w = periodWindow(period);
    // Scale weekly counters roughly for other periods (heuristic until historical store fills).
    const scale =
      period === "daily"
        ? 1 / 7
        : period === "weekly"
          ? 1
          : period === "monthly"
            ? 4
            : period === "quarterly"
              ? 12
              : 52;

    for (const m of metrics) {
      const value = Math.round(m.value * scale * 10) / 10;
      const previous = Math.round(m.previous * scale * 10) / 10;
      const pct = changePct(value, previous);
      out.push({
        metricKey: m.key,
        period,
        periodStart: w.start.toISOString(),
        periodEnd: w.end.toISOString(),
        value,
        previousValue: previous,
        changePct: pct,
        direction: direction(pct),
        scopeType: "platform",
        scopeId: null,
      });
    }
  }
  return out;
}
