import type { EligibleProviderCandidate } from "@/domains/matching/eligibility";
import { MATCHING_POLICY } from "@/domains/matching/policy";
import type { MatchReason } from "@/domains/matching/reasons";
import type { RankedAssignment } from "@/domains/matching/rank";
import { getProviderBehaviourSignals } from "@/lib/ai/provider/behaviour";
import { rankProvidersByMatchScore } from "@/lib/ai/matching/score";
import type { AiUrgencyLevel } from "@/lib/ai/decision/types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isSmartMatchingEngineEnabled } from "@/lib/config/feature-flags";

export type AiRankedAssignment = RankedAssignment & {
  aiMatchScore: number;
  aiExplanation: Array<{
    code: string;
    params?: Record<string, string | number>;
    labelEn: string;
  }>;
};

/**
 * AI-ranked scarce assignment selection (subscription-free).
 * Preserves newcomer oxygen from Matching policy.
 * When SMART_MATCHING_ENGINE is on, uses modular Sprint 8 engine.
 */
export async function selectAssignmentsWithAiRanking(
  candidates: EligibleProviderCandidate[],
  opts: {
    urgency: "emergency" | "normal";
    aiUrgency?: AiUrgencyLevel;
    max: number;
    source: "initial" | "expand";
    alreadyAssignedIds?: Set<string>;
    categorySlug?: string | null;
    serviceRequestId?: string | null;
    customerId?: string | null;
  },
): Promise<AiRankedAssignment[]> {
  const taken = opts.alreadyAssignedIds ?? new Set<string>();
  const pool = candidates.filter((c) => !taken.has(c.id));
  if (pool.length === 0) return [];

  const behaviour = await getProviderBehaviourSignals(pool.map((c) => c.id));
  const reputationMeta = await loadReputationMeta(pool.map((c) => c.id));
  const aiUrgency: AiUrgencyLevel =
    opts.aiUrgency ??
    (opts.urgency === "emergency" ? "high" : "medium");

  const scoreMap = new Map<
    string,
    {
      score: number;
      explanations: Array<{
        code: string;
        params?: Record<string, string | number>;
        labelEn: string;
      }>;
    }
  >();

  if (isSmartMatchingEngineEnabled()) {
    const { rankProvidersSmartMatch } = await import(
      "@/lib/matching-engine/service"
    );
    const smart = await rankProvidersSmartMatch({
      candidates: pool.map((c) => ({
        providerId: c.id,
        ratingAvg: c.ratingAvg,
        reviewCount: c.reviewCount,
        verificationStatus: c.verificationStatus,
        categoryFit: c.reasons.some((r) => r.code === "category_fit"),
        acceptingRequests: c.acceptingRequests,
        behaviour: behaviour.get(c.id) ?? null,
        reputationBoost: reputationMeta.get(c.id)?.boost ?? null,
        trustLevel: reputationMeta.get(c.id)?.trustLevel ?? null,
      })),
      customerId: opts.customerId,
      requestId: opts.serviceRequestId,
      requestSalt: opts.serviceRequestId ?? undefined,
      persist: true,
    });
    for (const s of smart) {
      scoreMap.set(s.providerId, {
        score: s.internalScore,
        explanations: s.explanations.map((e) => ({
          code: e.code,
          params: e.params,
          labelEn: e.labelEn,
        })),
      });
    }
  } else {
    const scored = rankProvidersByMatchScore(
      pool.map((c) => ({
        providerId: c.id,
        ratingAvg: c.ratingAvg,
        reviewCount: c.reviewCount,
        verificationStatus: c.verificationStatus,
        cityFit: c.reasons.some((r) => r.code === "city_fit"),
        categoryFit: c.reasons.some((r) => r.code === "category_fit"),
        acceptingRequests: c.acceptingRequests,
        behaviour: behaviour.get(c.id) ?? null,
        reputationBoost: reputationMeta.get(c.id)?.boost ?? null,
        trustLevel: reputationMeta.get(c.id)?.trustLevel ?? null,
      })),
      { urgency: aiUrgency, categorySlug: opts.categorySlug },
    );
    for (const s of scored) {
      scoreMap.set(s.providerId, {
        score: s.score,
        explanations: s.explanations ?? [],
      });
    }
  }

  const sorted = [...pool].sort((a, b) => {
    const sa = scoreMap.get(a.id)?.score ?? 0;
    const sb = scoreMap.get(b.id)?.score ?? 0;
    return sb - sa;
  });

  const newcomers = sorted.filter(
    (c) => c.reviewCount < MATCHING_POLICY.newcomerReviewThreshold,
  );
  const established = sorted.filter(
    (c) => c.reviewCount >= MATCHING_POLICY.newcomerReviewThreshold,
  );

  const selected: AiRankedAssignment[] = [];
  const pick = (
    c: EligibleProviderCandidate,
    source: RankedAssignment["source"],
  ) => {
    if (selected.some((s) => s.providerId === c.id)) return;
    if (selected.length >= opts.max) return;
    const ai = scoreMap.get(c.id);
    const reasons: MatchReason[] =
      source === "newcomer"
        ? [...c.reasons, { code: "newcomer_exploration" }]
        : [...c.reasons];
    if (ai && ai.score >= 90) {
      reasons.push({ code: "high_rating", params: { rating: ai.score } });
    }
    selected.push({
      providerId: c.id,
      ownerId: c.ownerId,
      reasons,
      rank: selected.length + 1,
      source,
      aiMatchScore: ai?.score ?? 0,
      aiExplanation: ai?.explanations ?? [],
    });
  };

  for (const c of established) pick(c, opts.source);
  let newcomersAdded = 0;
  for (const c of newcomers) {
    if (newcomersAdded >= MATCHING_POLICY.newcomerMax) break;
    if (selected.length >= opts.max) break;
    pick(c, "newcomer");
    newcomersAdded += 1;
  }
  for (const c of sorted) {
    if (selected.length >= opts.max) break;
    pick(c, opts.source);
  }

  const ranked = selected.map((a, i) => ({ ...a, rank: i + 1 }));

  void emitAiLearningEvent({
    eventType: "match_ranked",
    serviceRequestId: opts.serviceRequestId,
    metadata: {
      count: ranked.length,
      topScore: ranked[0]?.aiMatchScore ?? null,
      urgency: aiUrgency,
      engine: isSmartMatchingEngineEnabled() ? "smart-match-v1" : "legacy",
    },
  });

  return ranked;
}

async function loadReputationMeta(
  providerIds: string[],
): Promise<Map<string, { boost: number; trustLevel: string }>> {
  const map = new Map<string, { boost: number; trustLevel: string }>();
  if (providerIds.length === 0) return map;
  try {
    const { isAiReputationEngineEnabled } = await import(
      "@/lib/config/feature-flags"
    );
    if (!isAiReputationEngineEnabled()) return map;
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data } = await admin
      .from("provider_reputation_scores")
      .select("provider_id, recommendation_boost, trust_level")
      .in("provider_id", providerIds);
    for (const row of data ?? []) {
      map.set(row.provider_id, {
        boost: Number(row.recommendation_boost ?? 0),
        trustLevel: String(row.trust_level),
      });
    }
  } catch {
    /* optional */
  }
  return map;
}
