/**
 * Sprint 41 — Admin Control Center 2.0 KPI aggregation.
 * Extends getControlCenterOverview; does not replace it.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getControlCenterOverview,
  listAdminActivityFeed,
  type AdminActivityItem,
  type ControlCenterOverview,
} from "@/lib/admin/control-center";
import { getSearchAnalytics } from "@/lib/admin/queries";
import { listAdminAiExtensions } from "@/lib/admin/ai-hooks";

export type ControlCenterV2Kpis = {
  legacy: ControlCenterOverview;
  totalUsers: number;
  totalProviders: number;
  verifiedProviders: number;
  pendingVerifications: number;
  bookingsToday: number;
  bookingsThisMonth: number;
  completedJobs: number;
  activeConversations: number;
  averageRating: number;
  averageDalilyScore: number;
  issueReports: number;
  openModerationItems: number;
  searchesToday: number;
  searchSuccessRate: number;
  topCategories: Array<{ id: string; name: string; count: number }>;
  topCities: Array<{ id: string; name: string; count: number }>;
  recentActivity: AdminActivityItem[];
  aiExtensionsReady: string[];
};

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfUtcMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function safeCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getControlCenterV2Kpis(): Promise<ControlCenterV2Kpis> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const todayStart = startOfUtcDay();
  const monthStart = startOfUtcMonth();

  const [
    legacy,
    recentActivity,
    totalUsers,
    totalProviders,
    verifiedProviders,
    pendingVerifications,
    bookingsToday,
    bookingsThisMonth,
    completedJobs,
    activeConversations,
    issueReports,
    openIssues,
    searchesToday,
    searchesWithResults,
    searchesTotalToday,
    ratingRows,
    trustRows,
    categoryRows,
    cityRows,
  ] = await Promise.all([
    getControlCenterOverview(),
    listAdminActivityFeed(15),
    safeCount(admin.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null)),
    safeCount(admin.from("providers").select("id", { count: "exact", head: true }).is("deleted_at", null)),
    safeCount(
      admin
        .from("providers")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "verified")
        .is("deleted_at", null),
    ),
    safeCount(
      admin.from("provider_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ),
    safeCount(
      db.from("bookings").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", todayStart),
    ),
    safeCount(
      db.from("bookings").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", monthStart),
    ),
    safeCount(
      db
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["completed", "customer_confirmed"]),
    ),
    safeCount(
      admin
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("closed_at", null)
        .eq("status", "open"),
    ),
    safeCount(
      db.from("booking_issue_reports").select("id", { count: "exact", head: true }).is("deleted_at", null),
    ),
    safeCount(
      db
        .from("booking_issue_reports")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("moderation_status", ["open", "in_progress"]),
    ),
    safeCount(admin.from("search_logs").select("id", { count: "exact", head: true }).gte("created_at", todayStart)),
    safeCount(
      admin
        .from("search_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .gt("result_count", 0),
    ),
    safeCount(admin.from("search_logs").select("id", { count: "exact", head: true }).gte("created_at", todayStart)),
    admin
      .from("providers")
      .select("rating_avg")
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(2000),
    admin
      .from("providers")
      .select("trust_score")
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(2000),
    admin
      .from("providers")
      .select("category_id")
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(3000),
    admin
      .from("providers")
      .select("city_id")
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(3000),
  ]);

  const ratings = (ratingRows.data ?? []).map((r) => Number(r.rating_avg) || 0).filter((n) => n > 0);
  const averageRating = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : 0;

  const trusts = (trustRows.data ?? []).map((r) => Number(r.trust_score) || 0);
  const averageDalilyScore = trusts.length
    ? Math.round(trusts.reduce((a, b) => a + b, 0) / trusts.length)
    : 0;

  const catCounts = new Map<string, number>();
  for (const row of categoryRows.data ?? []) {
    if (!row.category_id) continue;
    catCounts.set(row.category_id, (catCounts.get(row.category_id) ?? 0) + 1);
  }
  const cityCounts = new Map<string, number>();
  for (const row of cityRows.data ?? []) {
    if (!row.city_id) continue;
    cityCounts.set(row.city_id, (cityCounts.get(row.city_id) ?? 0) + 1);
  }

  const topCatIds = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCityIds = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const [{ data: cats }, { data: cities }] = await Promise.all([
    topCatIds.length
      ? admin.from("categories").select("id, name").in(
          "id",
          topCatIds.map(([id]) => id),
        )
      : Promise.resolve({ data: [] as Array<{ id: string; name: unknown }> }),
    topCityIds.length
      ? admin.from("cities").select("id, name").in(
          "id",
          topCityIds.map(([id]) => id),
        )
      : Promise.resolve({ data: [] as Array<{ id: string; name: unknown }> }),
  ]);

  const catName = new Map(
    (cats ?? []).map((c) => {
      const n = c.name as { en?: string; ar?: string };
      return [c.id, n.en || n.ar || c.id];
    }),
  );
  const cityName = new Map(
    (cities ?? []).map((c) => {
      const n = c.name as { en?: string; ar?: string };
      return [c.id, n.en || n.ar || c.id];
    }),
  );

  const searchSuccessRate =
    searchesTotalToday > 0 ? Math.round((searchesWithResults / searchesTotalToday) * 100) : 0;

  // Fallback open moderation: pending reviews + open issues
  const pendingReviews = await safeCount(
    admin
      .from("service_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),
  );

  return {
    legacy,
    totalUsers,
    totalProviders,
    verifiedProviders,
    pendingVerifications,
    bookingsToday,
    bookingsThisMonth,
    completedJobs,
    activeConversations,
    averageRating,
    averageDalilyScore,
    issueReports,
    openModerationItems: openIssues + pendingReviews + legacy.pendingBusinesses,
    searchesToday,
    searchSuccessRate,
    topCategories: topCatIds.map(([id, count]) => ({
      id,
      name: catName.get(id) ?? id,
      count,
    })),
    topCities: topCityIds.map(([id, count]) => ({
      id,
      name: cityName.get(id) ?? id,
      count,
    })),
    recentActivity,
    aiExtensionsReady: listAdminAiExtensions(),
  };
}

export type PlatformAnalyticsSnapshot = {
  bookingsTotal: number;
  bookingsMonth: number;
  chatsActive: number;
  reviewsTotal: number;
  searchesMonth: number;
  completionRate: number;
  cancellationRate: number;
  customerGrowthWeek: number;
  providerGrowthWeek: number;
  exportReady: true;
};

export async function getPlatformAnalyticsSnapshot(): Promise<PlatformAnalyticsSnapshot> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const monthStart = startOfUtcMonth();
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const weekIso = weekAgo.toISOString();

  const [
    bookingsTotal,
    bookingsMonth,
    chatsActive,
    reviewsTotal,
    searchesMonth,
    completed,
    cancelled,
    customerGrowthWeek,
    providerGrowthWeek,
  ] = await Promise.all([
    safeCount(db.from("bookings").select("id", { count: "exact", head: true }).is("deleted_at", null)),
    safeCount(
      db.from("bookings").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", monthStart),
    ),
    safeCount(
      admin.from("conversations").select("id", { count: "exact", head: true }).is("deleted_at", null).is("closed_at", null),
    ),
    safeCount(admin.from("service_reviews").select("id", { count: "exact", head: true }).is("deleted_at", null)),
    safeCount(admin.from("search_logs").select("id", { count: "exact", head: true }).gte("created_at", monthStart)),
    safeCount(
      db
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["completed", "customer_confirmed"]),
    ),
    safeCount(
      db.from("bookings").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "cancelled"),
    ),
    safeCount(admin.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", weekIso)),
    safeCount(
      admin.from("providers").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", weekIso),
    ),
  ]);

  const decided = completed + cancelled;
  return {
    bookingsTotal,
    bookingsMonth,
    chatsActive,
    reviewsTotal,
    searchesMonth,
    completionRate: decided > 0 ? Math.round((completed / decided) * 100) : 0,
    cancellationRate: decided > 0 ? Math.round((cancelled / decided) * 100) : 0,
    customerGrowthWeek,
    providerGrowthWeek,
    exportReady: true,
  };
}

export async function getExtendedSearchAnalytics() {
  const base = await getSearchAnalytics();
  const admin = createAdminClient();
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  const { data: clicks } = await admin
    .from("learning_events")
    .select("event_type")
    .gte("created_at", weekAgo.toISOString())
    .limit(2000);

  const events = clicks ?? [];
  const impressions = events.filter((e) => e.event_type === "recommendation_shown").length;
  const clickEvents = events.filter((e) => e.event_type === "recommendation_clicked").length;
  const recommendationClickRate =
    impressions > 0 ? Math.round((clickEvents / impressions) * 100) : 0;

  return {
    ...base,
    recommendationClickRate,
    trendingServices: base.topProblems.slice(0, 5),
    trendingProblems: base.topProblems.slice(0, 8),
  };
}
