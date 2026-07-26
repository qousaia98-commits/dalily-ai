import type { EligibleProviderCandidate } from "@/domains/matching/eligibility";
import { MATCHING_POLICY } from "@/domains/matching/policy";
import type { MatchReason } from "@/domains/matching/reasons";
import type { RankedAssignment } from "@/domains/matching/rank";
import { getProviderBehaviourSignals } from "@/lib/ai/provider/behaviour";
import { rankProvidersByMatchScore } from "@/lib/ai/matching/score";
import type { AiUrgencyLevel } from "@/lib/ai/decision/types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  loadProviderDispatchProfiles,
  resolveRequestAnchor,
} from "@/lib/ai/dispatch/context";
import { planMarketplaceExposure } from "@/lib/ai/dispatch/exposure";
import { scoreDispatchCandidate } from "@/lib/ai/dispatch/score";
import { toAssignmentExplanationBullets } from "@/lib/ai/dispatch/explanations";
import { persistDispatchPredictions } from "@/lib/ai/dispatch/predictions";
import { upsertProviderReputation } from "@/lib/ai/dispatch/predictions";
import type {
  DispatchScoreResult,
  ExposureMode,
} from "@/lib/ai/dispatch/types";

export type DispatchRankedAssignment = RankedAssignment & {
  aiMatchScore: number;
  aiExplanation: Array<{
    code: string;
    params?: Record<string, string | number>;
    labelEn: string;
  }>;
  exposureMode: ExposureMode;
  responseBand: string;
  responseProbability: number;
  etaLabel: string;
  operationalScore: number;
  reputationScore: number;
  dispatchScore: DispatchScoreResult;
};

/**
 * Phase 3 smart dispatch:
 * capacity filter → operational score (route/response/ETA/reputation) → scarce pool.
 */
export async function selectAssignmentsWithSmartDispatch(
  candidates: EligibleProviderCandidate[],
  opts: {
    urgency: "emergency" | "normal";
    aiUrgency?: AiUrgencyLevel;
    max: number;
    source: "initial" | "expand";
    alreadyAssignedIds?: Set<string>;
    categorySlug?: string | null;
    serviceRequestId?: string | null;
    cityId?: string | null;
    expandArea?: boolean;
  },
): Promise<DispatchRankedAssignment[]> {
  const taken = opts.alreadyAssignedIds ?? new Set<string>();
  const pool = candidates.filter((c) => !taken.has(c.id));
  if (pool.length === 0) return [];

  const plan = planMarketplaceExposure({
    urgency: opts.urgency,
    aiUrgency: opts.aiUrgency,
    eligibleCount: pool.length,
    expandArea: opts.expandArea,
  });
  const max = Math.min(opts.max, plan.poolSize);

  const anchor = await resolveRequestAnchor({ cityId: opts.cityId ?? null });
  plan.requestLat = anchor.lat;
  plan.requestLng = anchor.lng;

  const providerIds = pool.map((c) => c.id);
  const [behaviour, profiles] = await Promise.all([
    getProviderBehaviourSignals(providerIds),
    loadProviderDispatchProfiles(providerIds),
  ]);

  const phase2 = rankProvidersByMatchScore(
    pool.map((c) => {
      const profile = profiles.get(c.id);
      const dist =
        plan.requestLat != null &&
        plan.requestLng != null &&
        profile?.lat != null &&
        profile?.lng != null
          ? undefined
          : undefined;
      void dist;
      return {
        providerId: c.id,
        ratingAvg: c.ratingAvg,
        reviewCount: c.reviewCount,
        verificationStatus: c.verificationStatus,
        cityFit: c.reasons.some((r) => r.code === "city_fit"),
        categoryFit: c.reasons.some((r) => r.code === "category_fit"),
        acceptingRequests: c.acceptingRequests,
        behaviour: behaviour.get(c.id) ?? null,
        distanceKm:
          plan.requestLat != null &&
          plan.requestLng != null &&
          profile?.lat != null &&
          profile?.lng != null
            ? // computed inside scoreDispatchCandidate; soft default here
              null
            : null,
      };
    }),
    {
      urgency: opts.aiUrgency ?? (opts.urgency === "emergency" ? "high" : "medium"),
      categorySlug: opts.categorySlug,
    },
  );
  const phase2Map = new Map(phase2.map((s) => [s.providerId, s]));

  const scored: Array<{
    candidate: EligibleProviderCandidate;
    dispatch: DispatchScoreResult;
  }> = [];

  for (const c of pool) {
    const profile = profiles.get(c.id);
    if (!profile) continue;
    if (opts.urgency === "emergency" && !profile.handlesEmergency) continue;

    const dispatch = scoreDispatchCandidate({
      profile,
      behaviour: behaviour.get(c.id) ?? null,
      phase2MatchScore: phase2Map.get(c.id)?.score ?? 50,
      plan,
      exposureMode: plan.exposureMode,
    });

    if (dispatch.overloaded && opts.urgency !== "emergency") {
      void emitAiLearningEvent({
        eventType: "capacity_skipped",
        providerId: c.id,
        serviceRequestId: opts.serviceRequestId,
        metadata: { remaining: dispatch.capacity.remainingMinutes },
      });
      continue;
    }

    if (dispatch.routeFit.fits) {
      void emitAiLearningEvent({
        eventType: "route_boosted",
        providerId: c.id,
        serviceRequestId: opts.serviceRequestId,
        metadata: {
          distanceFromJobKm: dispatch.routeFit.distanceFromJobKm,
          gapMinutes: dispatch.routeFit.gapMinutes,
        },
      });
    }

    scored.push({ candidate: c, dispatch });
  }

  scored.sort(
    (a, b) => b.dispatch.operationalScore - a.dispatch.operationalScore,
  );

  const sortedCandidates = scored.map((s) => s.candidate);
  const scoreMap = new Map(scored.map((s) => [s.candidate.id, s.dispatch]));

  const newcomers = sortedCandidates.filter(
    (c) => c.reviewCount < MATCHING_POLICY.newcomerReviewThreshold,
  );
  const established = sortedCandidates.filter(
    (c) => c.reviewCount >= MATCHING_POLICY.newcomerReviewThreshold,
  );

  const selected: DispatchRankedAssignment[] = [];
  const pick = (
    c: EligibleProviderCandidate,
    source: RankedAssignment["source"],
  ) => {
    if (selected.some((s) => s.providerId === c.id)) return;
    if (selected.length >= max) return;
    const d = scoreMap.get(c.id);
    if (!d) return;
    const reasons: MatchReason[] =
      source === "newcomer"
        ? [...c.reasons, { code: "newcomer_exploration" }]
        : [...c.reasons];
    selected.push({
      providerId: c.id,
      ownerId: c.ownerId,
      reasons,
      rank: selected.length + 1,
      source,
      aiMatchScore: d.operationalScore,
      aiExplanation: toAssignmentExplanationBullets(d.explanations, "provider"),
      exposureMode: plan.exposureMode,
      responseBand: d.responseBand,
      responseProbability: d.responseProbability,
      etaLabel: d.eta.labelEn,
      operationalScore: d.operationalScore,
      reputationScore: d.reputationScore,
      dispatchScore: d,
    });
  };

  for (const c of established) pick(c, opts.source);
  let newcomersAdded = 0;
  for (const c of newcomers) {
    if (newcomersAdded >= MATCHING_POLICY.newcomerMax) break;
    if (selected.length >= max) break;
    pick(c, "newcomer");
    newcomersAdded += 1;
  }
  for (const c of sortedCandidates) {
    if (selected.length >= max) break;
    pick(c, opts.source);
  }

  const ranked = selected.map((a, i) => ({ ...a, rank: i + 1 }));

  for (const r of ranked) {
    void upsertProviderReputation(
      r.providerId,
      r.reputationScore,
      {
        operational: r.operationalScore,
        response: r.responseProbability,
      },
      pool.find((p) => p.id === r.providerId)?.reviewCount ?? 0,
    );
  }

  if (opts.serviceRequestId) {
    void persistDispatchPredictions({
      serviceRequestId: opts.serviceRequestId,
      exposureMode: plan.exposureMode,
      ranked: ranked.map((r) => ({
        providerId: r.providerId,
        rank: r.rank,
        score: r.dispatchScore,
      })),
    });
  }

  void emitAiLearningEvent({
    eventType: "dispatch_exposed",
    serviceRequestId: opts.serviceRequestId,
    metadata: {
      exposureMode: plan.exposureMode,
      count: ranked.length,
      poolSize: max,
    },
  });

  void emitAiLearningEvent({
    eventType: "match_ranked",
    serviceRequestId: opts.serviceRequestId,
    metadata: {
      count: ranked.length,
      topScore: ranked[0]?.operationalScore ?? null,
      mode: "smart_dispatch",
    },
  });

  return ranked;
}
