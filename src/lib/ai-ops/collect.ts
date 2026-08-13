/**
 * Collect live platform counters for AI Ops (soft-fail missing tables).
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type LivePlatformCounters = {
  activeUsers: number;
  bookingsToday: number;
  bookingsWeek: number;
  bookingsPrevWeek: number;
  completedJobs: number;
  openCases: number;
  escalatedCases: number;
  fraudAlerts: number;
  trustDistribution: Record<string, number>;
  verificationPending: number;
  verificationVerified: number;
  reviewCountWeek: number;
  reviewCountPrevWeek: number;
  paymentsPaid: number;
  paymentsTotal: number;
  refundsWeek: number;
  paymentsWeek: number;
  complaintsWeek: number;
  complaintsPrevWeek: number;
  categories: Array<{
    id: string;
    name: string;
    bookings: number;
    providers: number;
  }>;
  regions: Array<{
    key: string;
    name: string;
    providers: number;
    bookings: number;
  }>;
};

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function startOfUtcDay(): string {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  ).toISOString();
}

async function safeCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PromiseLike<{ count: number | null; error: any }>,
): Promise<number> {
  try {
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

function localizedName(name: unknown, fallback: string): string {
  if (name && typeof name === "object") {
    const o = name as Record<string, string>;
    return o.en ?? o.ar ?? fallback;
  }
  if (typeof name === "string" && name) return name;
  return fallback;
}

export async function collectLivePlatformCounters(): Promise<LivePlatformCounters> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const today = startOfUtcDay();
  const weekAgo = daysAgo(7);
  const twoWeeksAgo = daysAgo(14);

  const [
    activeUsers,
    bookingsToday,
    bookingsWeek,
    bookingsPrevWeek,
    completedJobs,
    openCases,
    escalatedCases,
    fraudAlerts,
    verificationPending,
    verificationVerified,
    reviewCountWeek,
    reviewCountPrevWeek,
    paymentsPaid,
    paymentsTotal,
    refundsWeek,
    paymentsWeek,
    complaintsWeek,
    complaintsPrevWeek,
  ] = await Promise.all([
    safeCount(
      db.from("profiles").select("id", { count: "exact", head: true }).gte("updated_at", weekAgo),
    ),
    safeCount(
      db.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", today),
    ),
    safeCount(
      db.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    ),
    safeCount(
      db
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twoWeeksAgo)
        .lt("created_at", weekAgo),
    ),
    safeCount(
      db
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("status", ["completed", "customer_confirmed"]),
    ),
    safeCount(
      db
        .from("quality_cases")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", [
          "open",
          "pending_information",
          "under_review",
          "waiting_for_provider",
          "waiting_for_customer",
        ]),
    ),
    safeCount(
      db
        .from("quality_cases")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "escalated"),
    ),
    safeCount(
      db
        .from("fraud_events")
        .select("id", { count: "exact", head: true })
        .eq("false_positive", false)
        .is("resolved_at", null)
        .gte("created_at", weekAgo),
    ),
    safeCount(
      db
        .from("providers")
        .select("id", { count: "exact", head: true })
        .in("verification_status", ["pending", "submitted", "in_review"]),
    ),
    safeCount(
      db
        .from("providers")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "verified"),
    ),
    safeCount(
      db
        .from("service_reviews")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
    ),
    safeCount(
      db
        .from("service_reviews")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twoWeeksAgo)
        .lt("created_at", weekAgo),
    ),
    safeCount(
      db
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "paid")
        .gte("created_at", weekAgo),
    ),
    safeCount(
      db.from("payments").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    ),
    safeCount(
      db.from("refunds").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    ),
    safeCount(
      db.from("payments").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    ),
    safeCount(
      db
        .from("quality_cases")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", weekAgo),
    ),
    safeCount(
      db
        .from("quality_cases")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", twoWeeksAgo)
        .lt("created_at", weekAgo),
    ),
  ]);

  const trustDistribution: Record<string, number> = {};
  try {
    const { data: scores } = await db
      .from("provider_reputation_scores")
      .select("trust_level");
    for (const row of scores ?? []) {
      const k = String(row.trust_level ?? "unknown");
      trustDistribution[k] = (trustDistribution[k] ?? 0) + 1;
    }
  } catch {
    /* optional */
  }

  const categories: LivePlatformCounters["categories"] = [];
  try {
    const { data: cats } = await db
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .limit(12);
    for (const c of cats ?? []) {
      const providers = await safeCount(
        db
          .from("providers")
          .select("id", { count: "exact", head: true })
          .contains("category_ids", [c.id]),
      );
      categories.push({
        id: c.id,
        name: localizedName(c.name, c.slug ?? c.id),
        bookings: 0,
        providers,
      });
    }
  } catch {
    /* optional */
  }

  const regions: LivePlatformCounters["regions"] = [];
  try {
    const { data: cities } = await db.from("cities").select("id, name, slug").limit(12);
    for (const city of cities ?? []) {
      const providers = await safeCount(
        db
          .from("providers")
          .select("id", { count: "exact", head: true })
          .eq("city_id", city.id),
      );
      regions.push({
        key: city.id,
        name: localizedName(city.name, city.slug ?? city.id),
        providers,
        bookings: 0,
      });
    }
  } catch {
    /* optional */
  }

  return {
    activeUsers,
    bookingsToday,
    bookingsWeek,
    bookingsPrevWeek,
    completedJobs,
    openCases,
    escalatedCases,
    fraudAlerts,
    trustDistribution,
    verificationPending,
    verificationVerified,
    reviewCountWeek,
    reviewCountPrevWeek,
    paymentsPaid,
    paymentsTotal,
    refundsWeek,
    paymentsWeek,
    complaintsWeek,
    complaintsPrevWeek,
    categories,
    regions,
  };
}
