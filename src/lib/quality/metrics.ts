/**
 * Provider quality metrics recompute + insights.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderQualityInsights } from "@/lib/quality/types";

export async function recomputeProviderQualityMetrics(
  providerId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: cases } = await admin
      .from("quality_cases")
      .select(
        "id, category, status, created_at, resolved_at, satisfaction_score, customer_id",
      )
      .eq("provider_id", providerId)
      .is("deleted_at", null);

    const rows = cases ?? [];
    const total = rows.length;
    const open = rows.filter((c) =>
      ["open", "pending_information", "under_review", "waiting_for_provider", "waiting_for_customer", "escalated"].includes(
        c.status,
      ),
    ).length;
    const resolved = rows.filter((c) => c.status === "resolved" || c.status === "closed").length;
    const rejected = rows.filter((c) => c.status === "rejected").length;

    const resolvedWithTime = rows.filter((c) => c.resolved_at);
    let avgHours: number | null = null;
    if (resolvedWithTime.length > 0) {
      const sum = resolvedWithTime.reduce((acc, c) => {
        const ms =
          new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime();
        return acc + ms / 3_600_000;
      }, 0);
      avgHours = Math.round((sum / resolvedWithTime.length) * 10) / 10;
    }

    const sats = rows
      .map((c) => c.satisfaction_score)
      .filter((s): s is number => typeof s === "number");
    const avgSatisfaction =
      sats.length > 0
        ? Math.round((sats.reduce((a, b) => a + b, 0) / sats.length) * 10) / 10
        : null;

    const categoryBreakdown: Record<string, number> = {};
    for (const c of rows) {
      categoryBreakdown[c.category] = (categoryBreakdown[c.category] ?? 0) + 1;
    }

    const customerCounts = new Map<string, number>();
    for (const c of rows) {
      if (!c.customer_id) continue;
      customerCounts.set(c.customer_id, (customerCounts.get(c.customer_id) ?? 0) + 1);
    }
    let repeat = 0;
    for (const n of customerCounts.values()) {
      if (n >= 2) repeat += 1;
    }

    const { count: completedJobs } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .in("status", ["completed", "customer_confirmed"]);

    const jobs = completedJobs ?? 0;
    const complaintRate =
      jobs > 0 ? Math.round((total / jobs) * 10000) / 10000 : total > 0 ? 1 : 0;
    const resolutionRate =
      total > 0 ? Math.round((resolved / total) * 10000) / 10000 : null;

    await admin.from("quality_case_metrics").upsert(
      {
        provider_id: providerId,
        total_cases: total,
        open_cases: open,
        resolved_cases: resolved,
        rejected_cases: rejected,
        complaint_rate: complaintRate,
        resolution_rate: resolutionRate,
        avg_resolution_hours: avgHours,
        repeat_complaint_count: repeat,
        avg_satisfaction: avgSatisfaction,
        category_breakdown: categoryBreakdown,
        trend: [],
        computed_at: new Date().toISOString(),
      },
      { onConflict: "provider_id" },
    );
  } catch {
    /* soft until migration applied */
  }
}

export async function getProviderQualityInsights(
  providerId: string,
): Promise<ProviderQualityInsights> {
  const admin = createAdminClient();

  const [{ data: metrics }, { data: recent }] = await Promise.all([
    admin
      .from("quality_case_metrics")
      .select("*")
      .eq("provider_id", providerId)
      .maybeSingle(),
    admin
      .from("quality_cases")
      .select("id, case_number, category, status, created_at")
      .eq("provider_id", providerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (!metrics && (!recent || recent.length === 0)) {
    return {
      providerId,
      totalCases: 0,
      openCases: 0,
      resolvedCases: 0,
      resolutionRate: null,
      avgResolutionHours: null,
      complaintRate: null,
      repeatComplaintCount: 0,
      avgSatisfaction: null,
      categoryBreakdown: {},
      recommendations: [
        "Keep response times under one hour to prevent communication complaints.",
      ],
      recentCases: [],
    };
  }

  const categoryBreakdown =
    (metrics?.category_breakdown as Record<string, number>) ?? {};
  const recommendations = buildRecommendations({
    openCases: metrics?.open_cases ?? 0,
    resolutionRate: metrics?.resolution_rate != null ? Number(metrics.resolution_rate) : null,
    avgHours: metrics?.avg_resolution_hours != null ? Number(metrics.avg_resolution_hours) : null,
    categoryBreakdown,
    repeat: metrics?.repeat_complaint_count ?? 0,
  });

  return {
    providerId,
    totalCases: metrics?.total_cases ?? recent?.length ?? 0,
    openCases: metrics?.open_cases ?? 0,
    resolvedCases: metrics?.resolved_cases ?? 0,
    resolutionRate:
      metrics?.resolution_rate != null ? Number(metrics.resolution_rate) : null,
    avgResolutionHours:
      metrics?.avg_resolution_hours != null
        ? Number(metrics.avg_resolution_hours)
        : null,
    complaintRate:
      metrics?.complaint_rate != null ? Number(metrics.complaint_rate) : null,
    repeatComplaintCount: metrics?.repeat_complaint_count ?? 0,
    avgSatisfaction:
      metrics?.avg_satisfaction != null ? Number(metrics.avg_satisfaction) : null,
    categoryBreakdown,
    recommendations,
    recentCases: (recent ?? []).map((c) => ({
      id: c.id,
      caseNumber: c.case_number,
      category: c.category,
      status: c.status,
      createdAt: c.created_at,
    })),
  };
}

function buildRecommendations(input: {
  openCases: number;
  resolutionRate: number | null;
  avgHours: number | null;
  categoryBreakdown: Record<string, number>;
  repeat: number;
}): string[] {
  const tips: string[] = [];
  if (input.openCases > 0) {
    tips.push("Respond to open quality cases quickly — waiting customers lose trust.");
  }
  if (input.avgHours != null && input.avgHours > 48) {
    tips.push("Average resolution time is high. Aim to resolve within 24–48 hours.");
  }
  if ((input.categoryBreakdown.communication ?? 0) >= 2) {
    tips.push("Communication issues are recurring — reply to messages within one hour.");
  }
  if ((input.categoryBreakdown.late_arrival ?? 0) >= 2) {
    tips.push("Improve punctuality and send ETA updates before arrival.");
  }
  if ((input.categoryBreakdown.service_quality ?? 0) >= 2) {
    tips.push("Document completed work with photos to reduce quality disputes.");
  }
  if (input.repeat >= 1) {
    tips.push("Repeat complaints detected — review recurring customer friction points.");
  }
  if (input.resolutionRate != null && input.resolutionRate < 0.7) {
    tips.push("Raise your resolution rate by proposing clear remedies and follow-ups.");
  }
  if (tips.length === 0) {
    tips.push("Quality metrics look healthy. Keep documenting jobs and responding fast.");
  }
  return tips.slice(0, 5);
}
