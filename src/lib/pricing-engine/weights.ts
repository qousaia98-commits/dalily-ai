import type { PricingWeight } from "@/lib/pricing-engine/types";

export const DEFAULT_PRICING_WEIGHTS: PricingWeight[] = [
  { signalKey: "service_category", category: "market", weight: 1.4, enabled: true, mlReady: false },
  { signalKey: "region", category: "geo", weight: 0.8, enabled: true, mlReady: false },
  { signalKey: "travel_distance", category: "geo", weight: 0.7, enabled: true, mlReady: false },
  { signalKey: "travel_time", category: "geo", weight: 0.5, enabled: true, mlReady: true },
  { signalKey: "job_complexity", category: "job", weight: 1.2, enabled: true, mlReady: false },
  { signalKey: "estimated_duration", category: "job", weight: 1.0, enabled: true, mlReady: false },
  { signalKey: "urgency", category: "time", weight: 1.1, enabled: true, mlReady: false },
  { signalKey: "season", category: "time", weight: 0.4, enabled: true, mlReady: true },
  { signalKey: "day_of_week", category: "time", weight: 0.35, enabled: true, mlReady: false },
  { signalKey: "time_of_day", category: "time", weight: 0.3, enabled: true, mlReady: false },
  { signalKey: "historical_prices", category: "market", weight: 1.3, enabled: true, mlReady: true },
  { signalKey: "market_demand", category: "market", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "provider_reputation", category: "provider", weight: 0.6, enabled: true, mlReady: true },
  { signalKey: "provider_experience", category: "provider", weight: 0.5, enabled: true, mlReady: false },
  { signalKey: "material_requirements", category: "job", weight: 0.7, enabled: true, mlReady: false },
  { signalKey: "weather", category: "risk", weight: 0.2, enabled: true, mlReady: true },
  { signalKey: "holiday_calendar", category: "time", weight: 0.45, enabled: true, mlReady: false },
  { signalKey: "repeat_customer", category: "customer", weight: -0.25, enabled: true, mlReady: false },
  { signalKey: "business_customer", category: "customer", weight: 0.35, enabled: true, mlReady: false },
  { signalKey: "large_project", category: "job", weight: 0.9, enabled: true, mlReady: false },
  { signalKey: "ml_pricing", category: "ml", weight: 1.0, enabled: true, mlReady: true },
];

export function mergePricingWeights(
  defaults: PricingWeight[],
  overrides: Partial<PricingWeight>[],
): PricingWeight[] {
  const map = new Map(defaults.map((d) => [d.signalKey, { ...d }]));
  for (const o of overrides) {
    if (!o.signalKey) continue;
    const prev = map.get(o.signalKey);
    if (prev) map.set(o.signalKey, { ...prev, ...o });
  }
  return [...map.values()];
}
