/**
 * Smart matching service — rank, persist, feedback, experiments.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { collectMatchRawForCandidates } from "@/lib/matching-engine/collect";
import type { MatchCandidateInput } from "@/lib/matching-engine/collect";
import { computeMatchFromSignals } from "@/lib/matching-engine/engine";
import { trackMatchingEvent } from "@/lib/matching-engine/observability";
import { getCustomerPreferences } from "@/lib/matching-engine/preferences";
import {
  DEFAULT_MATCHING_WEIGHTS,
  mergeMatchingWeights,
} from "@/lib/matching-engine/weights";
import { isSmartMatchingEngineEnabled } from "@/lib/config/feature-flags";
import {
  MATCHING_MODEL_VERSION,
  type MatchComputation,
  type MatchWeight,
  type PublicMatchExplanation,
  type PublicMatchRecommendation,
} from "@/lib/matching-engine/types";
import type { Json } from "@/types/database.types";

export type RankedMatch = MatchComputation & {
  trustLevel: string | null;
  verificationStatus: string;
  ratingAvg: number;
  reviewCount: number;
};

const CACHE_TTL_MS = 60_000; // provider score cache ~60s for <150ms path

async function loadWeights(): Promise<MatchWeight[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("matching_weights").select("*");
    if (!data?.length) return DEFAULT_MATCHING_WEIGHTS;
    return mergeMatchingWeights(
      DEFAULT_MATCHING_WEIGHTS,
      data.map((r) => ({
        signalKey: r.signal_key,
        category: r.category,
        weight: Number(r.weight),
        enabled: r.enabled,
        mlReady: r.ml_ready,
        description: r.description,
      })),
    );
  } catch {
    return DEFAULT_MATCHING_WEIGHTS;
  }
}

async function resolveExperiment(
  customerId?: string | null,
): Promise<{ algorithm: string; experimentId: string | null }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("matching_experiments")
      .select("*")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!data) {
      return { algorithm: MATCHING_MODEL_VERSION, experimentId: null };
    }
    const pct = Number(data.traffic_b_pct ?? 0);
    let bucket = 0;
    if (customerId) {
      for (let i = 0; i < customerId.length; i++) {
        bucket = (bucket + customerId.charCodeAt(i)) % 100;
      }
    } else {
      bucket = Math.floor(Math.random() * 100);
    }
    const useB = bucket < pct;
    return {
      algorithm: useB ? data.algorithm_b : data.algorithm_a,
      experimentId: data.experiment_key,
    };
  } catch {
    return { algorithm: MATCHING_MODEL_VERSION, experimentId: null };
  }
}

export async function rankProvidersSmartMatch(input: {
  candidates: MatchCandidateInput[];
  customerId?: string | null;
  requestId?: string | null;
  requestSalt?: string;
  persist?: boolean;
}): Promise<RankedMatch[]> {
  if (!isSmartMatchingEngineEnabled()) return [];
  const started = Date.now();
  const weights = await loadWeights();
  const prefs = input.customerId
    ? await getCustomerPreferences(input.customerId)
    : null;
  const experiment = await resolveExperiment(input.customerId);
  const rawMap = await collectMatchRawForCandidates({
    candidates: input.candidates,
    customerId: input.customerId,
    prefs,
  });

  // Fairness state batch
  const fairnessMap = new Map<
    string,
    { explorationBoost?: number; coldStartBoost?: number; boostExpiresAt?: string | null }
  >();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("matching_fairness_state")
      .select("*")
      .in(
        "provider_id",
        input.candidates.map((c) => c.providerId),
      );
    for (const row of data ?? []) {
      fairnessMap.set(row.provider_id, {
        explorationBoost: Number(row.exploration_boost),
        coldStartBoost: Number(row.cold_start_boost),
        boostExpiresAt: row.boost_expires_at,
      });
    }
  } catch {
    /* optional */
  }

  const ranked: RankedMatch[] = [];
  for (const c of input.candidates) {
    const raw = rawMap.get(c.providerId);
    if (!raw) continue;
    // Soft skip overloaded / paused
    if (raw.vacationMode || raw.pauseMode) continue;
    if (raw.jobsToday >= raw.maxDailyJobs) continue;

    const computation = computeMatchFromSignals({
      providerId: c.providerId,
      raw,
      weights,
      requestSalt: input.requestSalt ?? input.requestId ?? undefined,
      fairnessState: fairnessMap.get(c.providerId),
      experimentId: experiment.experimentId,
      startedAt: started,
      includeMlLayer: experiment.algorithm.includes("ml"),
    });

    ranked.push({
      ...computation,
      trustLevel: c.trustLevel ?? null,
      verificationStatus: c.verificationStatus,
      ratingAvg: c.ratingAvg,
      reviewCount: c.reviewCount,
    });
  }

  ranked.sort((a, b) => b.internalScore - a.internalScore);

  const latency = Date.now() - started;
  void trackMatchingEvent("matching_calculated", {
    count: ranked.length,
    latencyMs: latency,
    algorithmVersion: experiment.algorithm,
    experimentId: experiment.experimentId,
    requestId: input.requestId,
  });
  void trackMatchingEvent("latency", { latencyMs: latency });

  if (input.persist !== false) {
    void persistMatchBatch({
      ranked,
      requestId: input.requestId,
      customerId: input.customerId,
      latencyMs: latency,
      algorithmVersion: experiment.algorithm,
      experimentId: experiment.experimentId,
    });
  }

  return ranked;
}

async function persistMatchBatch(input: {
  ranked: RankedMatch[];
  requestId?: string | null;
  customerId?: string | null;
  latencyMs: number;
  algorithmVersion: string;
  experimentId: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const cachedUntil = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    const scoreRows = input.ranked.slice(0, 40).map((r, i) => ({
      request_id: input.requestId ?? null,
      customer_id: input.customerId ?? null,
      provider_id: r.providerId,
      internal_score: r.internalScore,
      signal_breakdown: Object.fromEntries(
        r.signals.map((s) => [s.signalKey, s.contribution]),
      ) as Json,
      fairness_boost: r.fairnessBoost,
      ml_contribution: r.mlContribution,
      algorithm_version: r.algorithmVersion,
      experiment_id: input.experimentId,
      latency_ms: input.latencyMs,
      rank: i + 1,
      cached_until: cachedUntil,
    }));

    if (scoreRows.length) {
      const { data: inserted } = await admin
        .from("matching_scores")
        .insert(scoreRows)
        .select("id, provider_id");

      const idByProvider = new Map(
        (inserted ?? []).map((row) => [row.provider_id, row.id]),
      );
      const explanationRows = input.ranked.flatMap((r) => {
        const scoreId = idByProvider.get(r.providerId);
        return r.explanations.map((e) => ({
          score_id: scoreId ?? null,
          request_id: input.requestId ?? null,
          provider_id: r.providerId,
          code: e.code,
          label_en: e.labelEn,
          label_ar: e.labelAr ?? null,
          params: (e.params ?? {}) as Json,
        }));
      });
      if (explanationRows.length) {
        await admin.from("matching_explanations").insert(explanationRows);
      }
    }

    await admin.from("matching_history").insert({
      request_id: input.requestId ?? null,
      customer_id: input.customerId ?? null,
      provider_ids: input.ranked.map((r) => r.providerId) as Json,
      scores: input.ranked.map((r) => ({
        providerId: r.providerId,
        score: r.internalScore,
        rank: input.ranked.indexOf(r) + 1,
      })) as Json,
      algorithm_version: input.algorithmVersion,
      experiment_id: input.experimentId,
      latency_ms: input.latencyMs,
      source: "marketplace",
    });
  } catch {
    /* soft until migration */
  }
}

export function toPublicRecommendations(
  ranked: RankedMatch[],
  limit = 10,
): PublicMatchRecommendation[] {
  return ranked.slice(0, limit).map((r, i) => ({
    providerId: r.providerId,
    rank: i + 1,
    explanations: r.explanations,
    trustLevel: r.trustLevel,
    verificationStatus: r.verificationStatus,
    ratingAvg: r.ratingAvg,
    reviewCount: r.reviewCount,
  }));
}

export async function recordMatchFeedback(input: {
  requestId?: string | null;
  bookingId?: string | null;
  customerId?: string | null;
  providerId: string;
  recommended: boolean;
  accepted?: boolean | null;
  completed?: boolean | null;
  rating?: number | null;
  complaint?: boolean;
  repeatBooking?: boolean;
  algorithmVersion?: string;
}): Promise<void> {
  if (!isSmartMatchingEngineEnabled()) return;
  try {
    const admin = createAdminClient();
    await admin.from("matching_feedback").insert({
      request_id: input.requestId ?? null,
      booking_id: input.bookingId ?? null,
      customer_id: input.customerId ?? null,
      provider_id: input.providerId,
      recommended: input.recommended,
      accepted: input.accepted ?? null,
      completed: input.completed ?? null,
      rating: input.rating ?? null,
      complaint: input.complaint ?? false,
      repeat_booking: input.repeatBooking ?? false,
      algorithm_version: input.algorithmVersion ?? MATCHING_MODEL_VERSION,
    });

    if (input.accepted) {
      void trackMatchingEvent("recommendation_accepted", {
        providerId: input.providerId,
        requestId: input.requestId,
      });
    } else if (input.accepted === false) {
      void trackMatchingEvent("recommendation_ignored", {
        providerId: input.providerId,
      });
    }
    if (input.completed) {
      void trackMatchingEvent("booking_completed", {
        providerId: input.providerId,
      });
    }
    if (input.repeatBooking) {
      void trackMatchingEvent("repeat_booking", {
        providerId: input.providerId,
      });
    }
  } catch {
    /* soft */
  }
}

export async function updateMatchingWeight(input: {
  signalKey: string;
  weight: number;
  enabled?: boolean;
}): Promise<boolean> {
  if (!isSmartMatchingEngineEnabled()) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("matching_weights")
      .update({
        weight: input.weight,
        enabled: input.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("signal_key", input.signalKey);
    return !error;
  } catch {
    return false;
  }
}

export async function simulateMatching(input: {
  candidates: MatchCandidateInput[];
  customerId?: string | null;
}): Promise<{
  ranked: RankedMatch[];
  publicView: PublicMatchRecommendation[];
  latencyMs: number;
}> {
  const started = Date.now();
  const ranked = await rankProvidersSmartMatch({
    ...input,
    requestId: `sim-${Date.now()}`,
    persist: false,
  });
  return {
    ranked,
    publicView: toPublicRecommendations(ranked),
    latencyMs: Date.now() - started,
  };
}

export type { PublicMatchExplanation };
