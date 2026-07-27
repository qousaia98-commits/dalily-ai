import type { ScheduleWeight } from "@/lib/scheduling-engine/types";

export const DEFAULT_SCHEDULE_WEIGHTS: ScheduleWeight[] = [
  { signalKey: "current_bookings", category: "bookings", weight: 1.3, enabled: true, mlReady: false },
  { signalKey: "travel_distance", category: "travel", weight: 1.2, enabled: true, mlReady: true },
  { signalKey: "travel_time", category: "travel", weight: 1.1, enabled: true, mlReady: true },
  { signalKey: "traffic", category: "travel", weight: 0.3, enabled: true, mlReady: true },
  { signalKey: "working_hours", category: "time", weight: 1.0, enabled: true, mlReady: false },
  { signalKey: "availability", category: "capacity", weight: 1.1, enabled: true, mlReady: false },
  { signalKey: "provider_capacity", category: "capacity", weight: 1.2, enabled: true, mlReady: true },
  { signalKey: "breaks", category: "time", weight: 0.7, enabled: true, mlReady: false },
  { signalKey: "job_duration", category: "job", weight: 1.0, enabled: true, mlReady: false },
  { signalKey: "preparation_time", category: "job", weight: 0.55, enabled: true, mlReady: false },
  { signalKey: "cleanup_time", category: "job", weight: 0.45, enabled: true, mlReady: false },
  { signalKey: "customer_preferred_time", category: "customer", weight: 0.9, enabled: true, mlReady: false },
  { signalKey: "urgency", category: "customer", weight: 1.15, enabled: true, mlReady: false },
  { signalKey: "priority", category: "job", weight: 0.8, enabled: true, mlReady: false },
  { signalKey: "category", category: "job", weight: 0.5, enabled: true, mlReady: false },
  { signalKey: "required_skills", category: "job", weight: 0.85, enabled: true, mlReady: true },
  { signalKey: "weather", category: "risk", weight: 0.25, enabled: true, mlReady: true },
  { signalKey: "business_hours", category: "time", weight: 0.75, enabled: true, mlReady: false },
  { signalKey: "expected_overtime", category: "risk", weight: 0.65, enabled: true, mlReady: true },
  { signalKey: "current_fatigue", category: "risk", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "ml_scheduler", category: "ml", weight: 1.0, enabled: true, mlReady: true },
];

export function mergeScheduleWeights(
  defaults: ScheduleWeight[],
  overrides: Partial<ScheduleWeight>[],
): ScheduleWeight[] {
  const map = new Map(defaults.map((d) => [d.signalKey, { ...d }]));
  for (const o of overrides) {
    if (!o.signalKey) continue;
    const prev = map.get(o.signalKey);
    if (prev) map.set(o.signalKey, { ...prev, ...o });
  }
  return [...map.values()];
}
