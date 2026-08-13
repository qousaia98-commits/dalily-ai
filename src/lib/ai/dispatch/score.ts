import { haversineKm } from "@/lib/geo/distance";
import { clamp01 } from "@/lib/ai/types";
import { estimateCapacity, capacityScore } from "@/lib/ai/dispatch/capacity";
import { evaluateRouteFit, routeFitScore } from "@/lib/ai/dispatch/route";
import { predictResponse, responseBandScore } from "@/lib/ai/dispatch/response-prediction";
import { estimateEta } from "@/lib/ai/dispatch/eta";
import { computeReputation } from "@/lib/ai/dispatch/reputation";
import { buildDispatchExplanations } from "@/lib/ai/dispatch/explanations";
import type {
  DispatchPlan,
  DispatchScoreResult,
  ExposureMode,
  ProviderDispatchProfile,
} from "@/lib/ai/dispatch/types";
import type { ProviderBehaviourSignals } from "@/lib/ai/provider/behaviour";

const W = {
  match: 0.22,
  distance: 0.14,
  capacity: 0.14,
  route: 0.12,
  response: 0.14,
  reputation: 0.12,
  eta: 0.06,
  hours: 0.06,
} as const;

/**
 * Combined operational dispatch score 0–100.
 */
export function scoreDispatchCandidate(input: {
  profile: ProviderDispatchProfile;
  behaviour: ProviderBehaviourSignals | null;
  phase2MatchScore: number;
  plan: DispatchPlan;
  exposureMode: ExposureMode;
}): DispatchScoreResult {
  const profile = input.profile;
  const distanceKm =
    input.plan.requestLat != null &&
    input.plan.requestLng != null &&
    profile.lat != null &&
    profile.lng != null
      ? haversineKm(
          input.plan.requestLat,
          input.plan.requestLng,
          profile.lat,
          profile.lng,
        )
      : null;

  const bookedMinutes = profile.todayBookings.reduce((sum, b) => {
    const ms = new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime();
    return sum + Math.max(0, Math.round(ms / 60000));
  }, 0);

  const capacity = estimateCapacity({
    workingMinutes: profile.workingMinutesToday,
    bookedMinutes,
    bookingCount: profile.todayBookings.length,
    estimatedJobMinutes: input.plan.estimatedJobMinutes,
  });

  const routeFit = evaluateRouteFit({
    requestLat: input.plan.requestLat,
    requestLng: input.plan.requestLng,
    bookings: profile.todayBookings,
  });

  const response = predictResponse({
    behaviour: input.behaviour,
    acceptingRequests: profile.acceptingRequests,
    estimatedResponseHours: profile.estimatedResponseHours,
    capacity,
    isWithinWorkingHours: profile.isWithinWorkingHours,
  });

  const reputation = computeReputation({
    behaviour: input.behaviour,
    ratingAvg: profile.ratingAvg,
    verificationStatus: profile.verificationStatus,
  });

  const eta = estimateEta({
    distanceKm,
    routeFit,
    isWithinWorkingHours: profile.isWithinWorkingHours,
    estimatedResponseHours: profile.estimatedResponseHours,
  });

  const distScore =
    distanceKm == null
      ? 0.55
      : distanceKm <= 2
        ? 1
        : distanceKm <= 5
          ? 0.85
          : distanceKm <= 10
            ? 0.6
            : 0.3;

  const etaScore =
    eta.kind === "minutes" && eta.minutesMax != null && eta.minutesMax <= 45
      ? 1
      : eta.kind === "today_slot"
        ? 0.65
        : 0.35;

  const operational01 = clamp01(
    (input.phase2MatchScore / 100) * W.match +
      distScore * W.distance +
      capacityScore(capacity) * W.capacity +
      routeFitScore(routeFit) * W.route +
      responseBandScore(response.band) * W.response +
      (reputation.score / 100) * W.reputation +
      etaScore * W.eta +
      (profile.isWithinWorkingHours ? 1 : 0.25) * W.hours,
  );

  // Emergency: amplify availability + response + verification
  let operationalScore = Math.round(operational01 * 1000) / 10;
  if (input.plan.urgency === "emergency") {
    const boost =
      (profile.handlesEmergency ? 0.04 : 0) +
      responseBandScore(response.band) * 0.03;
    operationalScore = Math.round(clamp01(operational01 + boost) * 1000) / 10;
  }

  const base = {
    providerId: profile.providerId,
    operationalScore,
    matchScore: input.phase2MatchScore,
    reputationScore: reputation.score,
    responseBand: response.band,
    responseProbability: response.probability,
    eta,
    capacity,
    routeFit,
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 100) / 100,
    overloaded: capacity.overloaded,
  };

  return {
    ...base,
    explanations: buildDispatchExplanations({
      result: base,
      exposureMode: input.exposureMode,
    }),
  };
}
