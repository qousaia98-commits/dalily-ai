/**
 * Independent scheduling signal collectors — each returns a 0–1 score (higher = better plan fit).
 */

import { haversineKm } from "@/lib/geo/distance";
import type { ScheduleRawSignals } from "@/lib/scheduling-engine/types";

export type ScheduleSignalCollector = {
  signalKey: string;
  category: string;
  computeScore: (raw: ScheduleRawSignals) => {
    rawValue: number;
    score: number;
    metadata?: Record<string, unknown>;
  };
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function totalTravelKm(raw: ScheduleRawSignals): number {
  let km = 0;
  const geo = raw.stops.filter((s) => s.lat != null && s.lng != null);
  for (let i = 1; i < geo.length; i++) {
    km += haversineKm(geo[i - 1].lat!, geo[i - 1].lng!, geo[i].lat!, geo[i].lng!);
  }
  return km;
}

export const SCHEDULE_SIGNAL_COLLECTORS: ScheduleSignalCollector[] = [
  {
    signalKey: "current_bookings",
    category: "bookings",
    computeScore: (raw) => ({
      rawValue: raw.stops.length,
      score: clamp01(raw.stops.length / Math.max(1, raw.maxDailyJobs)),
    }),
  },
  {
    signalKey: "travel_distance",
    category: "travel",
    computeScore: (raw) => {
      const km = totalTravelKm(raw);
      return { rawValue: km, score: clamp01(1 - km / 40) };
    },
  },
  {
    signalKey: "travel_time",
    category: "travel",
    computeScore: (raw) => {
      const min = totalTravelKm(raw) * 2.5;
      return { rawValue: min, score: clamp01(1 - min / 120) };
    },
  },
  {
    signalKey: "traffic",
    category: "travel",
    computeScore: (raw) => ({
      rawValue: raw.traffic01,
      score: clamp01(1 - raw.traffic01 * 0.4),
      metadata: { futureReady: true },
    }),
  },
  {
    signalKey: "working_hours",
    category: "time",
    computeScore: (raw) => {
      const span = Math.max(1, raw.workingHoursEnd - raw.workingHoursStart);
      return { rawValue: span, score: clamp01(span / 10) };
    },
  },
  {
    signalKey: "availability",
    category: "capacity",
    computeScore: (raw) => ({
      rawValue: raw.pauseMode || raw.vacationMode ? 0 : 1,
      score: raw.pauseMode || raw.vacationMode ? 0.1 : 0.85,
    }),
  },
  {
    signalKey: "provider_capacity",
    category: "capacity",
    computeScore: (raw) => {
      const rem = Math.max(0, raw.maxDailyJobs - raw.jobsToday);
      return {
        rawValue: rem,
        score: clamp01(rem / Math.max(1, raw.maxDailyJobs)),
      };
    },
  },
  {
    signalKey: "breaks",
    category: "time",
    computeScore: (raw) => ({
      rawValue: raw.breakPreferredHour,
      score: 0.7,
    }),
  },
  {
    signalKey: "job_duration",
    category: "job",
    computeScore: (raw) => {
      const total = raw.stops.reduce((a, s) => a + s.durationMin, 0);
      return { rawValue: total, score: clamp01(1 - Math.abs(total - 240) / 360) };
    },
  },
  {
    signalKey: "preparation_time",
    category: "job",
    computeScore: (raw) => ({
      rawValue: raw.prepMinutes,
      score: clamp01(1 - raw.prepMinutes / 60),
    }),
  },
  {
    signalKey: "cleanup_time",
    category: "job",
    computeScore: (raw) => ({
      rawValue: raw.cleanupMinutes,
      score: clamp01(1 - raw.cleanupMinutes / 45),
    }),
  },
  {
    signalKey: "customer_preferred_time",
    category: "customer",
    computeScore: () => ({ rawValue: 1, score: 0.75 }),
  },
  {
    signalKey: "urgency",
    category: "customer",
    computeScore: (raw) => {
      const avg =
        raw.stops.length === 0
          ? 0
          : raw.stops.reduce((a, s) => a + s.urgency01, 0) / raw.stops.length;
      return { rawValue: avg, score: clamp01(0.5 + avg * 0.5) };
    },
  },
  {
    signalKey: "priority",
    category: "job",
    computeScore: (raw) => ({
      rawValue: raw.stops.length,
      score: 0.7,
    }),
  },
  {
    signalKey: "category",
    category: "job",
    computeScore: () => ({ rawValue: 1, score: 0.7 }),
  },
  {
    signalKey: "required_skills",
    category: "job",
    computeScore: () => ({ rawValue: 1, score: 0.8 }),
  },
  {
    signalKey: "weather",
    category: "risk",
    computeScore: (raw) => ({
      rawValue: raw.weather01,
      score: clamp01(1 - raw.weather01 * 0.2),
      metadata: { futureReady: true },
    }),
  },
  {
    signalKey: "business_hours",
    category: "time",
    computeScore: (raw) => ({
      rawValue: raw.workingHoursEnd - raw.workingHoursStart,
      score: 0.8,
    }),
  },
  {
    signalKey: "expected_overtime",
    category: "risk",
    computeScore: (raw) => {
      const last = raw.stops[raw.stops.length - 1];
      if (!last) return { rawValue: 0, score: 0.9 };
      const endH = new Date(last.endsAt).getUTCHours();
      const ot = Math.max(0, endH - raw.workingHoursEnd);
      return { rawValue: ot, score: clamp01(1 - ot / 3) };
    },
  },
  {
    signalKey: "current_fatigue",
    category: "risk",
    computeScore: (raw) => ({
      rawValue: raw.fatigue01,
      score: clamp01(1 - raw.fatigue01),
    }),
  },
];

export const ML_SCHEDULER_COLLECTOR: ScheduleSignalCollector = {
  signalKey: "ml_scheduler",
  category: "ml",
  computeScore: (raw) => {
    const v = raw.mlScheduleFactor ?? 1;
    return {
      rawValue: v,
      score: clamp01(0.5 + (v - 1) * 0.5),
      metadata: { ml: true },
    };
  },
};
