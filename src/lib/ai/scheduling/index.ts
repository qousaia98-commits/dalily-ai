/**
 * Scheduling bridge — Sprint 8 Phase 4.
 * Complements booking/smart day-optimize without replacing it.
 */
import { isAiSchedulingEnabled } from "@/lib/config/feature-flags";
import {
  getCustomerScheduleHint,
  getProviderScheduleInsights,
  optimizeProviderSchedule,
  toPublicDayOptimization,
  type PublicDayOptimization,
  type ProviderScheduleInsights,
  type CustomerScheduleHint,
} from "@/lib/scheduling-engine";

export const schedulingModule = {
  id: "ai-scheduling",
  status: "sprint8-phase4" as const,
  impl: ["src/lib/scheduling-engine/", "src/lib/booking/smart/day-optimize.ts"],
  future: ["live traffic", "road closures", "EV charging", "realtime ETA"],
};

export async function getPublicDaySchedule(input: {
  providerId: string;
  scheduleDate?: string;
}): Promise<PublicDayOptimization | null> {
  if (!isAiSchedulingEnabled()) return null;
  const c = await optimizeProviderSchedule({
    providerId: input.providerId,
    scheduleDate: input.scheduleDate,
    persist: false,
  });
  return c ? toPublicDayOptimization(c) : null;
}

export { getCustomerScheduleHint, getProviderScheduleInsights };

export type { PublicDayOptimization, ProviderScheduleInsights, CustomerScheduleHint };
