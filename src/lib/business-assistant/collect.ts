/**
 * Collect lightweight business metrics for a provider (own data only).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderCapacity } from "@/lib/matching-engine/capacity";
import type {
  BusinessOverviewMetrics,
  BusinessTrend,
} from "@/lib/business-assistant/types";

export type CollectedBusinessRaw = BusinessOverviewMetrics & {
  providerId: string;
  providerName: string | null;
  verified: boolean;
  reviewCount: number;
  ratingAvg: number;
  jobsToday: number;
  maxDailyJobs: number;
  weekendShare: number;
  topCategory: string | null;
  responseImproved: boolean;
};

export async function collectBusinessRaw(
  providerId: string,
): Promise<CollectedBusinessRaw> {
  const admin = createAdminClient();
  let providerName: string | null = null;
  let verified = false;
  let reviewCount = 0;
  let ratingAvg = 0;
  let trustLevel = 0.5;

  try {
    const { data: p } = await admin
      .from("providers")
      .select("id, name, verification_status, rating_avg, review_count")
      .eq("id", providerId)
      .maybeSingle();
    if (p) {
      const nameEn = p.name?.en;
      const nameAr = p.name?.ar;
      providerName =
        typeof nameEn === "string" && nameEn.trim().length > 0
          ? nameEn
          : typeof nameAr === "string" && nameAr.trim().length > 0
            ? nameAr
            : null;
      verified = String(p.verification_status ?? "") === "verified";
      ratingAvg = Number(p.rating_avg ?? 0);
      reviewCount = Number(p.review_count ?? 0);
      trustLevel = Math.min(
        1,
        (verified ? 0.35 : 0.1) + Math.min(0.5, ratingAvg / 5) + Math.min(0.15, reviewCount / 40),
      );
    }
  } catch {
    /* soft */
  }

  let bookings = 0;
  let completed = 0;
  let cancelled = 0;
  let revenue = 0;
  let acceptanceRate = 0.55;
  let completionRate = 0.5;
  let cancellationRate = 0.08;
  const responseTimeMin: number | null = 28;
  let weekendShare = 0.25;
  const topCategory: string | null = "general";

  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const { data: rows } = await admin
      .from("bookings")
      .select("id, status, starts_at")
      .eq("provider_id", providerId)
      .gte("created_at", since.toISOString())
      .limit(200);
    bookings = rows?.length ?? 0;
    completed = (rows ?? []).filter((r) =>
      ["completed", "customer_confirmed"].includes(String(r.status)),
    ).length;
    cancelled = (rows ?? []).filter((r) =>
      String(r.status).includes("cancel"),
    ).length;
    if (bookings > 0) {
      completionRate = completed / bookings;
      cancellationRate = cancelled / bookings;
      const weekend = (rows ?? []).filter((r) => {
        const d = new Date(r.starts_at as string).getUTCDay();
        return d === 5 || d === 6;
      }).length;
      weekendShare = weekend / bookings;
    }
    revenue = Math.round(completed * 150_000 + bookings * 20_000);
  } catch {
    /* soft defaults */
  }

  try {
    const { data: offers } = await admin
      .from("marketplace_offers")
      .select("id, status")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (offers?.length) {
      const selected = offers.filter((o) => o.status === "selected").length;
      acceptanceRate = selected / offers.length;
    }
  } catch {
    /* soft */
  }

  const capacity = await getProviderCapacity(providerId);
  const maxDailyJobs = capacity?.maxDailyJobs ?? 6;
  const jobsToday = capacity?.jobsToday ?? 0;
  const capacityUsage = Math.min(1, jobsToday / Math.max(1, maxDailyJobs));

  const customerSatisfaction =
    ratingAvg > 0 ? Math.round((ratingAvg / 5) * 1000) / 1000 : null;

  let reputationTrend: BusinessTrend = "stable";
  if (ratingAvg >= 4.5 && reviewCount >= 5) reputationTrend = "rising";
  else if (ratingAvg > 0 && ratingAvg < 3.5) reputationTrend = "declining";

  const businessHealthScore = Math.round(
    (trustLevel * 0.25 +
      completionRate * 0.2 +
      acceptanceRate * 0.15 +
      (customerSatisfaction ?? 0.6) * 0.2 +
      (1 - cancellationRate) * 0.1 +
      (1 - Math.abs(capacityUsage - 0.7)) * 0.1) *
      1000,
  ) / 1000;

  return {
    providerId,
    providerName,
    verified,
    reviewCount,
    ratingAvg,
    jobsToday,
    maxDailyJobs,
    weekendShare,
    topCategory,
    responseImproved: responseTimeMin != null && responseTimeMin <= 30,
    revenue,
    bookings,
    acceptanceRate: Math.round(acceptanceRate * 1000) / 1000,
    completionRate: Math.round(completionRate * 1000) / 1000,
    cancellationRate: Math.round(cancellationRate * 1000) / 1000,
    responseTimeMin,
    customerSatisfaction,
    trustLevel: Math.round(trustLevel * 1000) / 1000,
    reputationTrend,
    capacityUsage: Math.round(capacityUsage * 1000) / 1000,
    businessHealthScore,
    currency: "SYP",
  };
}
