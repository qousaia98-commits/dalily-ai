/**
 * Reputation persistence + recalculation service.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { collectProviderReputationRaw } from "@/lib/reputation/collect";
import { computeReputationFromSignals, mergeWeights } from "@/lib/reputation/engine";
import { generateExplanations } from "@/lib/reputation/explanations";
import { trackReputationEvent } from "@/lib/reputation/observability";
import type { ReputationComputation } from "@/lib/reputation/types";
import { isAiReputationEngineEnabled } from "@/lib/config/feature-flags";

export async function recalculateProviderReputation(
  providerId: string,
  opts?: { actorId?: string | null; snapshotPeriod?: "daily" | "weekly" | "monthly" | "snapshot" },
): Promise<ReputationComputation | null> {
  if (!isAiReputationEngineEnabled()) {
    return null;
  }

  const raw = await collectProviderReputationRaw(providerId);
  if (!raw) return null;

  const admin = createAdminClient();
  const [{ data: weightRows }, { data: previous }] = await Promise.all([
    admin
      .from("provider_reputation_weights")
      .select("signal_key, category, weight, enabled, ml_ready, description"),
    admin
      .from("provider_reputation_scores")
      .select("internal_score, trust_level, search_boost, recommendation_boost")
      .eq("provider_id", providerId)
      .maybeSingle(),
  ]);

  const weights = mergeWeights(weightRows ?? null);
  const computation = computeReputationFromSignals({
    providerId,
    raw,
    weights,
    previousScore: previous?.internal_score != null ? Number(previous.internal_score) : null,
  });

  await admin.from("provider_reputation_scores").upsert(
    {
      provider_id: providerId,
      internal_score: computation.internalScore,
      trust_level: computation.trustLevel,
      search_boost: computation.searchBoost,
      recommendation_boost: computation.recommendationBoost,
      trend: computation.trend,
      signal_breakdown: computation.breakdownByCategory,
      previous_score: previous?.internal_score ?? null,
      previous_trust_level: previous?.trust_level ?? null,
      computed_at: computation.computedAt,
      model_version: computation.modelVersion,
    },
    { onConflict: "provider_id" },
  );

  // Replace signal rows
  await admin.from("provider_reputation_signals").delete().eq("provider_id", providerId);
  if (computation.signals.length > 0) {
    await admin.from("provider_reputation_signals").insert(
      computation.signals.map((s) => ({
        provider_id: providerId,
        signal_key: s.signalKey,
        category: s.category,
        raw_value: s.rawValue,
        normalized_value: s.normalizedValue,
        weight: s.weight,
        contribution: s.contribution,
        source: s.source,
        metadata: s.metadata ?? {},
        computed_at: computation.computedAt,
      })),
    );
  }

  const explanations = generateExplanations(computation);
  await admin.from("provider_reputation_explanations").delete().eq("provider_id", providerId);
  if (explanations.length > 0) {
    await admin.from("provider_reputation_explanations").insert(
      explanations.map((e) => ({
        provider_id: providerId,
        audience: e.audience,
        locale: e.locale,
        explanation_key: e.explanationKey,
        body: e.body,
        polarity: e.polarity,
        sort_order: e.sortOrder,
        signal_key: e.signalKey ?? null,
        computed_at: computation.computedAt,
      })),
    );
  }

  // Sync public-facing quality label (no score) into Phase-2 cache
  try {
    await admin.from("provider_reputation_cache").upsert(
      {
        provider_id: providerId,
        quality_label: publicQualityLabel(computation.trustLevel),
        trust_level: computation.trustLevel,
        trend: computation.trend,
        computed_at: computation.computedAt,
        payload: {
          trustLevel: computation.trustLevel,
          trend: computation.trend,
        },
      },
      { onConflict: "provider_id" },
    );
  } catch {
    /* optional */
  }

  const period = opts?.snapshotPeriod ?? "snapshot";
  await admin.from("provider_reputation_history").insert({
    provider_id: providerId,
    period,
    internal_score: computation.internalScore,
    trust_level: computation.trustLevel,
    trend: computation.trend,
    signal_breakdown: computation.breakdownByCategory,
    search_boost: computation.searchBoost,
    recommendation_boost: computation.recommendationBoost,
    important_changes: buildImportantChanges(previous, computation),
  });

  await emitEvents(providerId, previous, computation, opts?.actorId ?? null);

  return computation;
}

function publicQualityLabel(level: string): string {
  switch (level) {
    case "excellent":
      return "Excellent";
    case "very_good":
      return "Very good";
    case "good":
      return "Good";
    case "developing":
      return "Fair";
    case "needs_attention":
      return "Needs improvement";
    default:
      return "Good";
  }
}

function buildImportantChanges(
  previous: {
    internal_score?: number | null;
    trust_level?: string | null;
    search_boost?: number | null;
    recommendation_boost?: number | null;
  } | null,
  next: ReputationComputation,
): Array<Record<string, unknown>> {
  const changes: Array<Record<string, unknown>> = [];
  if (previous?.trust_level && previous.trust_level !== next.trustLevel) {
    changes.push({
      type: "trust_level_changed",
      from: previous.trust_level,
      to: next.trustLevel,
    });
  }
  if (
    previous?.search_boost != null &&
    Math.abs(Number(previous.search_boost) - next.searchBoost) >= 0.01
  ) {
    changes.push({
      type: "search_boost_changed",
      from: previous.search_boost,
      to: next.searchBoost,
    });
  }
  if (
    previous?.recommendation_boost != null &&
    Math.abs(Number(previous.recommendation_boost) - next.recommendationBoost) >= 0.01
  ) {
    changes.push({
      type: "recommendation_boost_changed",
      from: previous.recommendation_boost,
      to: next.recommendationBoost,
    });
  }
  if (next.trend !== "stable") {
    changes.push({ type: "trend_generated", trend: next.trend });
  }
  return changes;
}

async function emitEvents(
  providerId: string,
  previous: {
    trust_level?: string | null;
    search_boost?: number | null;
    recommendation_boost?: number | null;
  } | null,
  computation: ReputationComputation,
  actorId: string | null,
) {
  const admin = createAdminClient();
  const rows: Array<{
    provider_id: string;
    event_type: string;
    actor_id: string | null;
    payload: Record<string, unknown>;
  }> = [
    {
      provider_id: providerId,
      event_type: "reputation_recalculated",
      actor_id: actorId,
      payload: {
        trustLevel: computation.trustLevel,
        trend: computation.trend,
        modelVersion: computation.modelVersion,
      },
    },
    {
      provider_id: providerId,
      event_type: "signal_updated",
      actor_id: actorId,
      payload: { count: computation.signals.length },
    },
  ];

  if (previous?.trust_level && previous.trust_level !== computation.trustLevel) {
    rows.push({
      provider_id: providerId,
      event_type: "trust_level_changed",
      actor_id: actorId,
      payload: { from: previous.trust_level, to: computation.trustLevel },
    });
  }
  if (
    previous?.search_boost != null &&
    Math.abs(Number(previous.search_boost) - computation.searchBoost) >= 0.01
  ) {
    rows.push({
      provider_id: providerId,
      event_type: "search_boost_changed",
      actor_id: actorId,
      payload: { from: previous.search_boost, to: computation.searchBoost },
    });
  }
  if (
    previous?.recommendation_boost != null &&
    Math.abs(Number(previous.recommendation_boost) - computation.recommendationBoost) >=
      0.01
  ) {
    rows.push({
      provider_id: providerId,
      event_type: "recommendation_boost_changed",
      actor_id: actorId,
      payload: {
        from: previous.recommendation_boost,
        to: computation.recommendationBoost,
      },
    });
  }
  if (computation.trend !== "stable") {
    rows.push({
      provider_id: providerId,
      event_type: "trend_generated",
      actor_id: actorId,
      payload: { trend: computation.trend },
    });
  }

  await admin.from("provider_reputation_events").insert(rows);

  for (const row of rows) {
    void trackReputationEvent(row.event_type as "reputation_recalculated", {
      providerId,
      ...row.payload,
    });
  }
}

export async function getProviderSearchBoost(providerId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("provider_reputation_scores")
      .select("search_boost")
      .eq("provider_id", providerId)
      .maybeSingle();
    return Number(data?.search_boost ?? 0);
  } catch {
    return 0;
  }
}

export async function getProviderRecommendationBoost(
  providerId: string,
): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("provider_reputation_scores")
      .select("recommendation_boost, trust_level")
      .eq("provider_id", providerId)
      .maybeSingle();
    return Number(data?.recommendation_boost ?? 0);
  } catch {
    return 0;
  }
}
