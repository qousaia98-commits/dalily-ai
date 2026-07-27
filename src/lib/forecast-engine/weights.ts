import type { ForecastWeight } from "@/lib/forecast-engine/types";

export const DEFAULT_FORECAST_WEIGHTS: ForecastWeight[] = [
  { signalKey: "historical_bookings", category: "history", weight: 1.4, enabled: true, mlReady: true },
  { signalKey: "category_demand", category: "market", weight: 1.2, enabled: true, mlReady: true },
  { signalKey: "regional_demand", category: "geo", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "seasonality", category: "time", weight: 0.8, enabled: true, mlReady: true },
  { signalKey: "weekday_patterns", category: "time", weight: 0.7, enabled: true, mlReady: false },
  { signalKey: "time_of_day", category: "time", weight: 0.55, enabled: true, mlReady: false },
  { signalKey: "holiday_calendar", category: "calendar", weight: 0.6, enabled: true, mlReady: false },
  { signalKey: "weather", category: "calendar", weight: 0.25, enabled: true, mlReady: true },
  { signalKey: "school_holidays", category: "calendar", weight: 0.45, enabled: true, mlReady: false },
  { signalKey: "business_events", category: "calendar", weight: 0.35, enabled: true, mlReady: false },
  { signalKey: "provider_availability", category: "supply", weight: 0.85, enabled: true, mlReady: false },
  { signalKey: "pricing_trends", category: "market", weight: 0.5, enabled: true, mlReady: true },
  { signalKey: "cancellation_trends", category: "quality", weight: 0.55, enabled: true, mlReady: true },
  { signalKey: "complaint_trends", category: "quality", weight: 0.4, enabled: true, mlReady: true },
  { signalKey: "economic_indicators", category: "market", weight: 0.2, enabled: true, mlReady: true },
  { signalKey: "ml_forecast", category: "ml", weight: 1.0, enabled: true, mlReady: true },
];

export function mergeForecastWeights(
  defaults: ForecastWeight[],
  overrides: Partial<ForecastWeight>[],
): ForecastWeight[] {
  const map = new Map(defaults.map((d) => [d.signalKey, { ...d }]));
  for (const o of overrides) {
    if (!o.signalKey) continue;
    const prev = map.get(o.signalKey);
    if (prev) map.set(o.signalKey, { ...prev, ...o });
  }
  return [...map.values()];
}
