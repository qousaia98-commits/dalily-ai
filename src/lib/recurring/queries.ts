/**
 * Recurring dashboard queries.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { mapPlan } from "./plans";
import { recommendRecurringFromHistory } from "./recommend";
import type {
  RecurringDashboard,
  RecurringPlan,
  RecurringRecommendation,
  RecurringVisit,
  RecurringVisitStatus,
} from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapVisit(row: Record<string, unknown>): RecurringVisit {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    bookingId: row.booking_id ? String(row.booking_id) : null,
    sequenceNumber: Number(row.sequence_number ?? 1),
    status: row.status as RecurringVisitStatus,
    plannedStartsAt: String(row.planned_starts_at),
    plannedEndsAt: String(row.planned_ends_at),
    skipReason: row.skip_reason ? String(row.skip_reason) : null,
  };
}

export async function getRecurringDashboard(
  customerId: string,
): Promise<RecurringDashboard> {
  const empty: RecurringDashboard = {
    activePlans: [],
    pausedPlans: [],
    upcomingVisits: [],
    completedVisits: [],
    renewals: [],
    recommendations: [],
    history: [],
    metrics: { retentionHintPct: null, completionRatePct: null },
  };

  try {
    const admin = db();
    const { data: plans } = await admin
      .from("recurring_plans")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);

    const mapped: RecurringPlan[] = (plans ?? []).map(
      (p: Record<string, unknown>) => mapPlan(p),
    );
    const activePlans = mapped.filter((p: RecurringPlan) => p.status === "active");
    const pausedPlans = mapped.filter((p: RecurringPlan) => p.status === "paused");
    const history = mapped.filter((p: RecurringPlan) =>
      ["cancelled", "expired"].includes(p.status),
    );

    const titleById = new Map(
      mapped.map((p: RecurringPlan) => [p.id, p.title] as const),
    );

    const { data: upcoming } = await admin
      .from("recurring_visits")
      .select("*, recurring_plans!inner(customer_id, title)")
      .eq("recurring_plans.customer_id", customerId)
      .in("status", ["scheduled", "confirmed", "rescheduled"])
      .gte("planned_starts_at", new Date().toISOString())
      .order("planned_starts_at", { ascending: true })
      .limit(20);

    const { data: completed } = await admin
      .from("recurring_visits")
      .select("*, recurring_plans!inner(customer_id, title)")
      .eq("recurring_plans.customer_id", customerId)
      .eq("status", "completed")
      .order("planned_starts_at", { ascending: false })
      .limit(20);

    const renewals = activePlans
      .filter((p: RecurringPlan) => p.endDate && p.autoRenew)
      .map((p: RecurringPlan) => ({
        planId: p.id,
        title: p.title,
        endDate: p.endDate!,
      }));

    let recommendations: RecurringRecommendation[] = [];
    try {
      const { data: pending } = await admin
        .from("recurring_recommendations")
        .select("*")
        .eq("customer_id", customerId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);

      if (pending?.length) {
        recommendations = pending.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          customerId,
          categorySlug: r.category_slug ? String(r.category_slug) : null,
          suggestedInterval: r.suggested_interval as RecurringRecommendation["suggestedInterval"],
          titleEn: String(r.title_en),
          titleAr: String(r.title_ar),
          reasonEn: String(r.reason_en),
          reasonAr: String(r.reason_ar),
          status: "pending",
          createdAt: String(r.created_at),
        }));
      } else {
        recommendations = await recommendRecurringFromHistory({ customerId });
      }
    } catch {
      recommendations = [];
    }

    const completedCount = mapped.reduce(
      (s: number, p: RecurringPlan) => s + p.completedVisitCount,
      0,
    );
    const skippedCount = mapped.reduce(
      (s: number, p: RecurringPlan) => s + p.skippedVisitCount,
      0,
    );
    const totalVisits = completedCount + skippedCount;
    const completionRatePct =
      totalVisits > 0
        ? Math.round((completedCount / totalVisits) * 1000) / 10
        : null;
    const activeOrPaused = activePlans.length + pausedPlans.length;
    const retentionHintPct =
      mapped.length > 0
        ? Math.round((activeOrPaused / mapped.length) * 1000) / 10
        : null;

    return {
      activePlans,
      pausedPlans,
      upcomingVisits: (upcoming ?? []).map((v: Record<string, unknown>) => ({
        ...mapVisit(v),
        planTitle:
          (v.recurring_plans as { title?: string } | undefined)?.title ??
          titleById.get(String(v.plan_id)) ??
          "Plan",
      })),
      completedVisits: (completed ?? []).map((v: Record<string, unknown>) => ({
        ...mapVisit(v),
        planTitle:
          (v.recurring_plans as { title?: string } | undefined)?.title ??
          titleById.get(String(v.plan_id)) ??
          "Plan",
      })),
      renewals,
      recommendations,
      history,
      metrics: { retentionHintPct, completionRatePct },
    };
  } catch {
    return empty;
  }
}
