/**
 * Collect raw match signals for candidates (soft-fail).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { MatchRawSignals } from "@/lib/matching-engine/types";
import type { CustomerPreferences } from "@/lib/matching-engine/types";

export type MatchCandidateInput = {
  providerId: string;
  ratingAvg: number;
  reviewCount: number;
  verificationStatus: string;
  categoryFit: boolean;
  acceptingRequests: boolean;
  distanceKm?: number | null;
  languageFit?: number;
  recentActivityScore?: number;
  behaviour?: {
    acceptanceRate?: number | null;
    avgResponseHours?: number | null;
    completionRate?: number | null;
    cancellationRate?: number | null;
  } | null;
  reputationBoost?: number | null;
  trustLevel?: string | null;
};

export async function collectMatchRawForCandidates(input: {
  candidates: MatchCandidateInput[];
  customerId?: string | null;
  prefs?: CustomerPreferences | null;
}): Promise<Map<string, MatchRawSignals>> {
  const map = new Map<string, MatchRawSignals>();
  const ids = input.candidates.map((c) => c.providerId);
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const capacity = new Map<string, Record<string, unknown>>();
  const qualityCounts = new Map<string, number>();
  const fraudScores = new Map<string, number>();
  const fairness = new Map<string, Record<string, unknown>>();

  try {
    const { data } = await db
      .from("provider_capacity")
      .select("*")
      .in("provider_id", ids);
    for (const row of data ?? []) capacity.set(row.provider_id, row);
  } catch {
    /* optional until migration */
  }

  try {
    const { data } = await db
      .from("matching_fairness_state")
      .select("*")
      .in("provider_id", ids);
    for (const row of data ?? []) fairness.set(row.provider_id, row);
  } catch {
    /* optional */
  }

  if (ids.length > 0) {
    try {
      for (const id of ids) {
        const { count } = await db
          .from("quality_cases")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", id)
          .is("deleted_at", null)
          .in("status", [
            "open",
            "pending_information",
            "under_review",
            "waiting_for_provider",
            "waiting_for_customer",
            "escalated",
          ]);
        qualityCounts.set(id, count ?? 0);
      }
    } catch {
      /* optional */
    }

    try {
      const { data } = await db
        .from("risk_scores")
        .select("entity_id, internal_score, risk_level")
        .eq("entity_type", "provider")
        .in("entity_id", ids);
      for (const row of data ?? []) {
        fraudScores.set(row.entity_id, Number(row.internal_score) / 100);
      }
    } catch {
      /* optional — never expose to customers */
    }
  }

  const favourites = new Set(input.prefs?.favouriteProviderIds ?? []);
  const hour = new Date().getUTCHours();

  for (const c of input.candidates) {
    const cap = capacity.get(c.providerId);
    const maxDaily = Number(cap?.max_daily_jobs ?? 8);
    const jobsToday = Number(cap?.jobs_today ?? 0);
    const vacation = Boolean(cap?.vacation_mode);
    const pause = Boolean(cap?.pause_mode);
    const accepting =
      cap?.accepting_requests != null
        ? Boolean(cap.accepting_requests)
        : c.acceptingRequests;

    let preferenceFit = 0.5;
    if (input.prefs?.preferredResponseSpeed === "fast") {
      preferenceFit +=
        c.behaviour?.avgResponseHours != null && c.behaviour.avgResponseHours < 2
          ? 0.25
          : 0;
    }
    if (favourites.has(c.providerId)) preferenceFit = 1;

    map.set(c.providerId, {
      distanceKm: c.distanceKm ?? null,
      travelTimeMin:
        c.distanceKm != null ? Math.round(c.distanceKm * 2.5) : null,
      acceptingRequests: accepting,
      workloadScore: maxDaily > 0 ? jobsToday / maxDaily : 0.5,
      vacationMode: vacation,
      pauseMode: pause,
      withinBusinessHours: hour >= 6 && hour <= 21,
      jobsToday,
      maxDailyJobs: maxDaily,
      reputationBoost: c.reputationBoost ?? null,
      trustLevel: c.trustLevel ?? null,
      verificationStatus: c.verificationStatus,
      categoryFit: c.categoryFit,
      experienceProxy: Math.min(1, c.reviewCount / 80),
      completedJobs: c.reviewCount,
      repeatCustomerRate: null,
      avgResponseHours: c.behaviour?.avgResponseHours ?? null,
      acceptanceRate: c.behaviour?.acceptanceRate ?? null,
      completionRate: c.behaviour?.completionRate ?? null,
      cancellationRate: c.behaviour?.cancellationRate ?? null,
      recommendationRate: null,
      ratingAvg: c.ratingAvg,
      reviewCount: c.reviewCount,
      recentActivityScore: c.recentActivityScore ?? 0.5,
      languageFit: c.languageFit ?? 0.6,
      priceCompetitiveness: 0.55,
      openQualityCases: qualityCounts.get(c.providerId) ?? 0,
      fraudRisk01: fraudScores.get(c.providerId) ?? 0,
      preferenceFit,
      preferredHistory: false,
      isFavourite: favourites.has(c.providerId),
      reviewCountForFairness: c.reviewCount,
      mlRankScore: null,
    });

    void fairness;
  }

  return map;
}
