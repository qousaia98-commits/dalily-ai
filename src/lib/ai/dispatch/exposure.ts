import { MATCHING_POLICY } from "@/domains/matching/policy";
import type { ExposureMode, DispatchPlan } from "@/lib/ai/dispatch/types";
import type { AiUrgencyLevel } from "@/lib/ai/decision/types";

/**
 * Choose marketplace exposure automatically — not every provider sees every request.
 */
export function planMarketplaceExposure(input: {
  urgency: "emergency" | "normal";
  aiUrgency?: AiUrgencyLevel | null;
  eligibleCount: number;
  expandArea?: boolean;
}): DispatchPlan {
  const ai = input.aiUrgency;
  const critical = ai === "critical" || input.urgency === "emergency";

  let exposureMode: ExposureMode = "limited_pool";
  let poolSize: number = MATCHING_POLICY.initialMaxAssignments;

  if (critical) {
    exposureMode = "emergency_broadcast";
    poolSize = MATCHING_POLICY.expandedMaxAssignments;
  } else if (input.eligibleCount <= 2) {
    exposureMode = "public_marketplace";
    poolSize = MATCHING_POLICY.expandedMaxAssignments;
  } else if (input.eligibleCount <= 5) {
    exposureMode = "immediate_dispatch";
    poolSize = Math.min(5, MATCHING_POLICY.initialMaxAssignments);
  } else if (input.expandArea) {
    exposureMode = "public_marketplace";
    poolSize = MATCHING_POLICY.expandedMaxAssignments;
  } else {
    exposureMode = "limited_pool";
    poolSize = MATCHING_POLICY.initialMaxAssignments;
  }

  if (
    !critical &&
    input.eligibleCount >= 12 &&
    exposureMode === "limited_pool"
  ) {
    exposureMode = "private_invitation";
    poolSize = Math.min(6, poolSize);
  }

  return {
    exposureMode,
    poolSize,
    urgency: input.urgency,
    estimatedJobMinutes: critical ? 90 : 60,
    requestLat: null,
    requestLng: null,
  };
}
