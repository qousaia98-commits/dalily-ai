/**
 * Independent forecast signal collectors — each returns a demand factor (~0.7–1.5).
 */

import type { ForecastRawSignals } from "@/lib/forecast-engine/types";

export type ForecastSignalCollector = {
  signalKey: string;
  category: string;
  computeFactor: (raw: ForecastRawSignals) => {
    rawValue: number;
    factor: number;
    metadata?: Record<string, unknown>;
  };
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export const FORECAST_SIGNAL_COLLECTORS: ForecastSignalCollector[] = [
  {
    signalKey: "historical_bookings",
    category: "history",
    computeFactor: (raw) => ({
      rawValue: raw.historicalIndex,
      factor: clamp(0.75 + raw.historicalIndex * 0.5, 0.75, 1.45),
    }),
  },
  {
    signalKey: "category_demand",
    category: "market",
    computeFactor: (raw) => ({
      rawValue: raw.categoryDemandIndex,
      factor: clamp(0.8 + raw.categoryDemandIndex * 0.45, 0.8, 1.4),
    }),
  },
  {
    signalKey: "regional_demand",
    category: "geo",
    computeFactor: (raw) => ({
      rawValue: raw.regionalDemandIndex,
      factor: clamp(0.85 + raw.regionalDemandIndex * 0.35, 0.85, 1.3),
    }),
  },
  {
    signalKey: "seasonality",
    category: "time",
    computeFactor: (raw) => ({
      rawValue: raw.seasonality01,
      factor: clamp(0.9 + raw.seasonality01 * 0.3, 0.9, 1.25),
    }),
  },
  {
    signalKey: "weekday_patterns",
    category: "time",
    computeFactor: (raw) => ({
      rawValue: raw.weekdayBoost,
      factor: clamp(raw.weekdayBoost, 0.85, 1.25),
    }),
  },
  {
    signalKey: "time_of_day",
    category: "time",
    computeFactor: (raw) => ({
      rawValue: raw.timeOfDayBoost,
      factor: clamp(raw.timeOfDayBoost, 0.9, 1.2),
    }),
  },
  {
    signalKey: "holiday_calendar",
    category: "calendar",
    computeFactor: (raw) => ({
      rawValue: raw.holiday ? 1 : 0,
      factor: raw.holiday ? 1.15 : 1,
    }),
  },
  {
    signalKey: "weather",
    category: "calendar",
    computeFactor: (raw) => ({
      rawValue: raw.weather01,
      factor: clamp(1 + raw.weather01 * 0.1, 1, 1.12),
      metadata: { futureReady: true },
    }),
  },
  {
    signalKey: "school_holidays",
    category: "calendar",
    computeFactor: (raw) => ({
      rawValue: raw.schoolHoliday ? 1 : 0,
      factor: raw.schoolHoliday ? 1.08 : 1,
    }),
  },
  {
    signalKey: "business_events",
    category: "calendar",
    computeFactor: (raw) => ({
      rawValue: raw.businessEvent ? 1 : 0,
      factor: raw.businessEvent ? 1.1 : 1,
    }),
  },
  {
    signalKey: "provider_availability",
    category: "supply",
    computeFactor: (raw) => {
      // Low availability → higher perceived demand pressure
      const pressure = 1 - raw.providerAvailability01;
      return {
        rawValue: raw.providerAvailability01,
        factor: clamp(0.9 + pressure * 0.35, 0.9, 1.3),
      };
    },
  },
  {
    signalKey: "pricing_trends",
    category: "market",
    computeFactor: (raw) => ({
      rawValue: raw.pricingTrend01,
      factor: clamp(0.95 + raw.pricingTrend01 * 0.15, 0.95, 1.15),
    }),
  },
  {
    signalKey: "cancellation_trends",
    category: "quality",
    computeFactor: (raw) => ({
      // High cancellations soften effective demand
      rawValue: raw.cancellationRate01,
      factor: clamp(1 - raw.cancellationRate01 * 0.2, 0.8, 1),
    }),
  },
  {
    signalKey: "complaint_trends",
    category: "quality",
    computeFactor: (raw) => ({
      rawValue: raw.complaintRate01,
      factor: clamp(1 - raw.complaintRate01 * 0.12, 0.85, 1),
    }),
  },
  {
    signalKey: "economic_indicators",
    category: "market",
    computeFactor: (raw) => ({
      rawValue: raw.economic01,
      factor: clamp(0.95 + raw.economic01 * 0.1, 0.95, 1.1),
      metadata: { futureReady: true },
    }),
  },
];

export const ML_FORECAST_COLLECTOR: ForecastSignalCollector = {
  signalKey: "ml_forecast",
  category: "ml",
  computeFactor: (raw) => {
    const v = raw.mlDemandFactor ?? 1;
    return {
      rawValue: v,
      factor: clamp(v, 0.8, 1.35),
      metadata: { ml: true },
    };
  },
};
