import { clamp01 } from "@/lib/ai/types";
import type { CapacityEstimate, ResponseBand } from "@/lib/ai/dispatch/types";
import type { ProviderBehaviourSignals } from "@/lib/ai/provider/behaviour";

/**
 * Predict response probability and band.
 */
export function predictResponse(input: {
  behaviour: ProviderBehaviourSignals | null;
  acceptingRequests: boolean;
  estimatedResponseHours: number | null;
  capacity: CapacityEstimate;
  isWithinWorkingHours: boolean;
  recentActivityScore?: number;
}): { probability: number; band: ResponseBand } {
  if (!input.acceptingRequests) {
    return { probability: 0.05, band: "low" };
  }

  const acceptance = input.behaviour?.acceptanceRate ?? 0.5;
  const responseHours =
    input.estimatedResponseHours ??
    input.behaviour?.avgResponseHours ??
    6;
  const responseSpeed = clamp01(1 - Math.min(responseHours, 48) / 48);
  const workload = input.capacity.overloaded
    ? 0.15
    : clamp01(input.capacity.remainingMinutes / 240);
  const hoursOpen = input.isWithinWorkingHours ? 1 : 0.35;
  const activity = input.recentActivityScore ?? 0.55;

  const probability = clamp01(
    acceptance * 0.35 +
      responseSpeed * 0.25 +
      workload * 0.2 +
      hoursOpen * 0.12 +
      activity * 0.08,
  );

  return { probability, band: bandFromProbability(probability) };
}

export function bandFromProbability(p: number): ResponseBand {
  if (p >= 0.8) return "very_high";
  if (p >= 0.6) return "high";
  if (p >= 0.35) return "medium";
  return "low";
}

export function responseBandScore(band: ResponseBand): number {
  switch (band) {
    case "very_high":
      return 1;
    case "high":
      return 0.8;
    case "medium":
      return 0.5;
    case "low":
      return 0.2;
  }
}
