/**
 * Pricing signal collectors — each returns a multiplicative factor (~0.7–1.5).
 */

import type { PricingRawSignals } from "@/lib/pricing-engine/types";

export type PricingSignalCollector = {
  signalKey: string;
  category: string;
  computeFactor: (raw: PricingRawSignals) => {
    rawValue: number;
    factor: number;
    metadata?: Record<string, unknown>;
  };
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export const PRICING_SIGNAL_COLLECTORS: PricingSignalCollector[] = [
  {
    signalKey: "service_category",
    category: "market",
    computeFactor: (raw) => ({
      rawValue: raw.baseMarketAvg,
      factor: 1,
    }),
  },
  {
    signalKey: "region",
    category: "geo",
    computeFactor: (raw) => {
      // Capital / dense regions slightly higher; unknown = 1
      const uplift =
        raw.regionKey !== "all" && raw.regionKey.length > 0 ? 1.05 : 1;
      return { rawValue: uplift, factor: uplift };
    },
  },
  {
    signalKey: "travel_distance",
    category: "geo",
    computeFactor: (raw) => {
      const km = raw.distanceKm;
      let f = 1;
      if (km != null) {
        if (km > 20) f = 1.18;
        else if (km > 10) f = 1.1;
        else if (km > 5) f = 1.04;
      }
      return { rawValue: km ?? 0, factor: f };
    },
  },
  {
    signalKey: "travel_time",
    category: "geo",
    computeFactor: (raw) => {
      const m = raw.travelTimeMin;
      let f = 1;
      if (m != null) {
        if (m > 60) f = 1.12;
        else if (m > 30) f = 1.06;
      }
      return { rawValue: m ?? 0, factor: f };
    },
  },
  {
    signalKey: "job_complexity",
    category: "job",
    computeFactor: (raw) => ({
      rawValue: raw.complexity01,
      factor: clamp(0.85 + raw.complexity01 * 0.45, 0.85, 1.35),
    }),
  },
  {
    signalKey: "estimated_duration",
    category: "job",
    computeFactor: (raw) => ({
      rawValue: raw.durationHours,
      factor: clamp(0.9 + Math.min(raw.durationHours, 8) * 0.06, 0.9, 1.4),
    }),
  },
  {
    signalKey: "urgency",
    category: "time",
    computeFactor: (raw) => ({
      rawValue: raw.urgency01,
      factor: clamp(1 + raw.urgency01 * 0.35, 1, 1.4),
    }),
  },
  {
    signalKey: "season",
    category: "time",
    computeFactor: (raw) => ({
      rawValue: raw.season01,
      factor: clamp(0.95 + raw.season01 * 0.15, 0.95, 1.15),
    }),
  },
  {
    signalKey: "day_of_week",
    category: "time",
    computeFactor: (raw) => ({
      rawValue: raw.weekend ? 1 : 0,
      factor: raw.weekend ? 1.08 : 1,
    }),
  },
  {
    signalKey: "time_of_day",
    category: "time",
    computeFactor: (raw) => ({
      rawValue: raw.peakHours ? 1 : 0,
      factor: raw.peakHours ? 1.05 : 1,
    }),
  },
  {
    signalKey: "historical_prices",
    category: "market",
    computeFactor: (raw) => {
      if (raw.historicalAvg == null || raw.baseMarketAvg <= 0) {
        return { rawValue: 0, factor: 1 };
      }
      const ratio = raw.historicalAvg / raw.baseMarketAvg;
      return { rawValue: raw.historicalAvg, factor: clamp(ratio, 0.85, 1.25) };
    },
  },
  {
    signalKey: "market_demand",
    category: "market",
    computeFactor: (raw) => ({
      rawValue: raw.demandIndex,
      factor: clamp(0.9 + raw.demandIndex * 0.25, 0.9, 1.25),
    }),
  },
  {
    signalKey: "provider_reputation",
    category: "provider",
    computeFactor: (raw) => {
      const b = raw.reputationBoost ?? 0;
      return { rawValue: b, factor: clamp(1 + b * 0.8, 0.95, 1.15) };
    },
  },
  {
    signalKey: "provider_experience",
    category: "provider",
    computeFactor: (raw) => ({
      rawValue: raw.experience01,
      factor: clamp(0.95 + raw.experience01 * 0.12, 0.95, 1.12),
    }),
  },
  {
    signalKey: "material_requirements",
    category: "job",
    computeFactor: (raw) => ({
      rawValue: raw.materials01,
      factor: clamp(1 + raw.materials01 * 0.25, 1, 1.3),
    }),
  },
  {
    signalKey: "weather",
    category: "risk",
    computeFactor: (raw) => ({
      rawValue: raw.weather01,
      factor: clamp(1 + raw.weather01 * 0.08, 1, 1.1),
      metadata: { futureReady: true },
    }),
  },
  {
    signalKey: "holiday_calendar",
    category: "time",
    computeFactor: (raw) => ({
      rawValue: raw.holiday ? 1 : 0,
      factor: raw.holiday ? 1.12 : 1,
    }),
  },
  {
    signalKey: "repeat_customer",
    category: "customer",
    computeFactor: (raw) => ({
      rawValue: raw.repeatCustomer ? 1 : 0,
      factor: raw.repeatCustomer ? 0.95 : 1,
    }),
  },
  {
    signalKey: "business_customer",
    category: "customer",
    computeFactor: (raw) => ({
      rawValue: raw.businessCustomer ? 1 : 0,
      factor: raw.businessCustomer ? 1.08 : 1,
    }),
  },
  {
    signalKey: "large_project",
    category: "job",
    computeFactor: (raw) => ({
      rawValue: raw.largeProject ? 1 : 0,
      factor: raw.largeProject ? 1.2 : 1,
    }),
  },
];

export const ML_PRICING_COLLECTOR: PricingSignalCollector = {
  signalKey: "ml_pricing",
  category: "ml",
  computeFactor: (raw) => {
    const v = raw.mlPriceFactor ?? 1;
    return {
      rawValue: v,
      factor: clamp(v, 0.85, 1.25),
      metadata: { ml: true },
    };
  },
};
