/**
 * Admin reputation dashboard queries — full calculation visible to admins only.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { TrustLevel, ReputationTrend } from "@/lib/reputation/types";

export type AdminReputationRow = {
  providerId: string;
  businessName: string | null;
  trustLevel: TrustLevel;
  internalScore: number;
  trend: ReputationTrend;
  searchBoost: number;
  recommendationBoost: number;
  computedAt: string;
};

export type AdminReputationDashboard = {
  distribution: Record<TrustLevel, number>;
  highest: AdminReputationRow[];
  rising: AdminReputationRow[];
  declining: AdminReputationRow[];
  needsReview: AdminReputationRow[];
  complaintHeavy: AdminReputationRow[];
};

export async function getAdminReputationDashboard(): Promise<AdminReputationDashboard> {
  const admin = createAdminClient();

  const { data: scores } = await admin
    .from("provider_reputation_scores")
    .select(
      "provider_id, internal_score, trust_level, trend, search_boost, recommendation_boost, computed_at, signal_breakdown",
    )
    .order("internal_score", { ascending: false })
    .limit(200);

  const rows = scores ?? [];
  const providerIds = rows.map((r) => r.provider_id);
  const { data: providers } = providerIds.length
    ? await admin.from("providers").select("id, name").in("id", providerIds)
    : { data: [] as Array<{ id: string; name: unknown }> };

  const nameById = new Map(
    (providers ?? []).map((p) => [
      p.id,
      typeof p.name === "object" && p.name && "en" in (p.name as object)
        ? String((p.name as { en?: string; ar?: string }).en || (p.name as { ar?: string }).ar || "")
        : typeof p.name === "string"
          ? p.name
          : null,
    ]),
  );

  const mapped: AdminReputationRow[] = rows.map((r) => ({
    providerId: r.provider_id,
    businessName: nameById.get(r.provider_id) ?? null,
    trustLevel: r.trust_level as TrustLevel,
    internalScore: Number(r.internal_score),
    trend: r.trend as ReputationTrend,
    searchBoost: Number(r.search_boost),
    recommendationBoost: Number(r.recommendation_boost),
    computedAt: r.computed_at,
  }));

  const distribution: Record<TrustLevel, number> = {
    excellent: 0,
    very_good: 0,
    good: 0,
    developing: 0,
    new_provider: 0,
    needs_attention: 0,
  };
  for (const r of mapped) {
    distribution[r.trustLevel] = (distribution[r.trustLevel] ?? 0) + 1;
  }

  // Complaint-heavy: reliability category weak in breakdown
  const complaintHeavy = rows
    .filter((r) => {
      const breakdown = r.signal_breakdown as Record<string, number> | null;
      return breakdown && Number(breakdown.reliability ?? 1) < 0.45;
    })
    .map((r) => mapped.find((m) => m.providerId === r.provider_id)!)
    .filter(Boolean)
    .slice(0, 15);

  return {
    distribution,
    highest: mapped.slice(0, 15),
    rising: mapped.filter((r) => r.trend === "rising").slice(0, 15),
    declining: mapped.filter((r) => r.trend === "declining").slice(0, 15),
    needsReview: mapped
      .filter(
        (r) =>
          r.trustLevel === "needs_attention" || r.trustLevel === "developing",
      )
      .slice(0, 20),
    complaintHeavy,
  };
}

export async function getAdminProviderReputationDetail(providerId: string) {
  const admin = createAdminClient();
  const [score, signals, history, events, explanations] = await Promise.all([
    admin
      .from("provider_reputation_scores")
      .select("*")
      .eq("provider_id", providerId)
      .maybeSingle(),
    admin
      .from("provider_reputation_signals")
      .select("*")
      .eq("provider_id", providerId)
      .order("contribution", { ascending: false }),
    admin
      .from("provider_reputation_history")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("provider_reputation_events")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("provider_reputation_explanations")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order"),
  ]);

  return {
    score: score.data,
    signals: signals.data ?? [],
    history: history.data ?? [],
    events: events.data ?? [],
    explanations: explanations.data ?? [],
  };
}
