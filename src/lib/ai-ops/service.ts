/**
 * AI Ops service — refresh snapshot, persist trends/anomalies/alerts, action center.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateAlertRules } from "@/lib/ai-ops/alerts";
import { detectAnomalies } from "@/lib/ai-ops/anomalies";
import { collectLivePlatformCounters } from "@/lib/ai-ops/collect";
import { buildHealthSnapshot } from "@/lib/ai-ops/health";
import { generateAiOpsInsights } from "@/lib/ai-ops/insights";
import {
  mapAlert,
  mapAnomaly,
  mapCategoryHealth,
  mapHealth,
  mapRegionHealth,
  mapTask,
  mapTrend,
} from "@/lib/ai-ops/map";
import { trackAiOpsEvent } from "@/lib/ai-ops/observability";
import { computeTrendsFromCounters } from "@/lib/ai-ops/trends";
import { isAiOpsEnabled } from "@/lib/config/feature-flags";
import type {
  AiOpsInsight,
  CategoryHealth,
  OpsTask,
  PlatformAlert,
  PlatformAnomaly,
  PlatformHealthSnapshot,
  PlatformTrend,
  RegionHealth,
} from "@/lib/ai-ops/types";
import type { Json } from "@/types/database.types";

export type AiOpsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function audit(
  action: string,
  actorId: string | null,
  entityType?: string,
  entityId?: string,
  note?: string,
) {
  try {
    const admin = createAdminClient();
    await admin.from("platform_ops_audit").insert({
      action,
      actor_id: actorId,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      note: note ?? null,
    });
  } catch {
    /* soft */
  }
}

export async function refreshPlatformOps(input?: {
  actorId?: string | null;
}): Promise<
  AiOpsResult<{
    health: PlatformHealthSnapshot;
    trends: PlatformTrend[];
    anomalies: PlatformAnomaly[];
    alerts: PlatformAlert[];
    insights: AiOpsInsight[];
    categories: CategoryHealth[];
    regions: RegionHealth[];
  }>
> {
  if (!isAiOpsEnabled()) return { ok: false, error: "feature_disabled" };

  const admin = createAdminClient();
  const counters = await collectLivePlatformCounters();
  const health = buildHealthSnapshot(counters);
  const trendDrafts = computeTrendsFromCounters(counters);
  const anomalyDrafts = detectAnomalies(counters);
  const alertDrafts = evaluateAlertRules({ counters, health });
  const insights = generateAiOpsInsights({
    counters,
    health,
    trends: trendDrafts,
  });

  const { data: healthRow } = await admin
    .from("platform_health_metrics")
    .insert({
      snapshot_at: health.snapshotAt,
      period: health.period,
      active_users: health.activeUsers,
      bookings_today: health.bookingsToday,
      completed_jobs: health.completedJobs,
      open_cases: health.openCases,
      escalated_cases: health.escalatedCases,
      fraud_alerts: health.fraudAlerts,
      trust_distribution: health.trustDistribution as Json,
      verification_pending: health.verificationPending,
      verification_verified: health.verificationVerified,
      review_count_period: health.reviewCountPeriod,
      payment_success_rate: health.paymentSuccessRate,
      refund_rate: health.refundRate,
      system_health: health.systemHealth,
      overall_score: health.overallScore,
    })
    .select("*")
    .single();

  void trackAiOpsEvent("health_snapshot", {
    systemHealth: health.systemHealth,
    overallScore: health.overallScore,
  });

  const persistedTrends: PlatformTrend[] = [];
  for (const t of trendDrafts.filter((x) => x.period === "weekly")) {
    const { data } = await admin
      .from("platform_trends")
      .upsert(
        {
          metric_key: t.metricKey,
          period: t.period,
          period_start: t.periodStart,
          period_end: t.periodEnd,
          value: t.value,
          previous_value: t.previousValue,
          change_pct: t.changePct,
          direction: t.direction,
          scope_type: t.scopeType,
          scope_id: t.scopeId,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "metric_key,period,period_start,scope_type,scope_id" },
      )
      .select("*")
      .maybeSingle();
    if (data) persistedTrends.push(mapTrend(data));
  }
  void trackAiOpsEvent("trend_generated", { count: persistedTrends.length });

  // Also store other periods without requiring all in response
  for (const t of trendDrafts.filter((x) => x.period !== "weekly")) {
    await admin.from("platform_trends").upsert(
      {
        metric_key: t.metricKey,
        period: t.period,
        period_start: t.periodStart,
        period_end: t.periodEnd,
        value: t.value,
        previous_value: t.previousValue,
        change_pct: t.changePct,
        direction: t.direction,
        scope_type: t.scopeType,
        scope_id: t.scopeId,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "metric_key,period,period_start,scope_type,scope_id" },
    );
  }

  const persistedAnomalies: PlatformAnomaly[] = [];
  for (const a of anomalyDrafts) {
    const { data } = await admin
      .from("platform_anomalies")
      .insert({
        anomaly_type: a.anomalyType,
        severity: a.severity,
        title: a.title,
        summary: a.summary,
        metric_key: a.metricKey,
        baseline_value: a.baselineValue,
        current_value: a.currentValue,
        deviation_pct: a.deviationPct,
        scope_type: a.scopeType,
        scope_id: a.scopeId,
      })
      .select("*")
      .single();
    if (data) {
      persistedAnomalies.push(mapAnomaly(data));
      void trackAiOpsEvent("anomaly_detected", {
        anomalyType: a.anomalyType,
        severity: a.severity,
      });
    }
  }

  const persistedAlerts: PlatformAlert[] = [];
  for (const draft of alertDrafts) {
    const { data: existing } = await admin
      .from("platform_alerts")
      .select("id")
      .eq("alert_key", draft.alertKey)
      .eq("status", "open")
      .maybeSingle();
    if (existing) continue;

    const { data } = await admin
      .from("platform_alerts")
      .insert({
        alert_key: draft.alertKey,
        title: draft.title,
        body: draft.body,
        severity: draft.severity,
        status: "open",
        source: draft.source,
        threshold_value: draft.thresholdValue,
        current_value: draft.currentValue,
      })
      .select("*")
      .single();
    if (data) {
      persistedAlerts.push(mapAlert(data));
      void trackAiOpsEvent("alert_created", { alertKey: draft.alertKey });
    }
  }

  const categories: CategoryHealth[] = [];
  for (const c of counters.categories) {
    const healthScore = Math.max(
      0,
      Math.min(100, 60 + c.providers * 2 - (c.bookings === 0 && c.providers > 5 ? 15 : 0)),
    );
    const trustLevel =
      healthScore >= 85
        ? "excellent"
        : healthScore >= 70
          ? "very_good"
          : healthScore >= 55
            ? "good"
            : "developing";
    const { data } = await admin
      .from("category_health")
      .upsert(
        {
          category_id: c.id,
          category_name: c.name,
          trust_level: trustLevel,
          growth_pct: null,
          complaint_rate: null,
          cancellation_rate: null,
          average_rating: null,
          completion_rate: null,
          customer_satisfaction: null,
          booking_count: c.bookings,
          provider_count: c.providers,
          health_score: healthScore,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "category_id" },
      )
      .select("*")
      .maybeSingle();
    if (data) categories.push(mapCategoryHealth(data));
  }

  const regions: RegionHealth[] = [];
  for (const r of counters.regions) {
    const healthScore = Math.max(
      0,
      Math.min(100, 50 + r.providers * 3 + Math.min(20, r.bookings)),
    );
    const { data } = await admin
      .from("region_health")
      .upsert(
        {
          region_key: r.key,
          region_name: r.name,
          provider_density: r.providers,
          demand_count: r.bookings,
          avg_response_hours: null,
          complaint_rate: null,
          trust_distribution: counters.trustDistribution as Json,
          booking_count: r.bookings,
          health_score: healthScore,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "region_key" },
      )
      .select("*")
      .maybeSingle();
    if (data) regions.push(mapRegionHealth(data));
  }

  await audit("health_refresh", input?.actorId ?? null, "platform", "ops");

  // Load open alerts if none newly created
  const { data: openAlerts } = await admin
    .from("platform_alerts")
    .select("*")
    .in("status", ["open", "acknowledged"])
    .order("created_at", { ascending: false })
    .limit(30);

  return {
    ok: true,
    data: {
      health: healthRow ? mapHealth(healthRow) : health,
      trends: persistedTrends.length
        ? persistedTrends
        : trendDrafts
            .filter((t) => t.period === "weekly")
            .map((t, i) => ({ ...t, id: `tmp-${i}` })),
      anomalies: persistedAnomalies,
      alerts: persistedAlerts.length
        ? persistedAlerts
        : (openAlerts ?? []).map(mapAlert),
      insights,
      categories,
      regions,
    },
  };
}

export async function acknowledgeAlert(input: {
  alertId: string;
  actorId: string;
}): Promise<AiOpsResult<PlatformAlert>> {
  if (!isAiOpsEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("platform_alerts")
    .update({
      status: "acknowledged",
      acknowledged_by: input.actorId,
      acknowledged_at: now,
      assigned_admin_id: input.actorId,
      updated_at: now,
    })
    .eq("id", input.alertId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "update_failed" };
  await audit("alert_acknowledged", input.actorId, "alert", input.alertId);
  void trackAiOpsEvent("alert_acknowledged", { alertId: input.alertId });
  return { ok: true, data: mapAlert(data) };
}

export async function resolveAlert(input: {
  alertId: string;
  actorId: string;
}): Promise<AiOpsResult<PlatformAlert>> {
  if (!isAiOpsEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("platform_alerts")
    .update({
      status: "resolved",
      resolved_at: now,
      updated_at: now,
    })
    .eq("id", input.alertId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "update_failed" };
  await audit("alert_resolved", input.actorId, "alert", input.alertId);
  return { ok: true, data: mapAlert(data) };
}

export async function createOpsTask(input: {
  title: string;
  body?: string;
  priority?: OpsTask["priority"];
  actorId: string;
  alertId?: string | null;
  relatedHref?: string | null;
  assignToSelf?: boolean;
}): Promise<AiOpsResult<OpsTask>> {
  if (!isAiOpsEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_ops_tasks")
    .insert({
      title: input.title.trim().slice(0, 200),
      body: input.body?.trim().slice(0, 2000) ?? null,
      priority: input.priority ?? "medium",
      created_by: input.actorId,
      assigned_admin_id: input.assignToSelf ? input.actorId : null,
      alert_id: input.alertId ?? null,
      related_href: input.relatedHref ?? null,
      status: input.assignToSelf ? "in_progress" : "open",
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "create_failed" };
  await audit("task_created", input.actorId, "task", data.id);
  return { ok: true, data: mapTask(data) };
}

export async function completeOpsTask(input: {
  taskId: string;
  actorId: string;
}): Promise<AiOpsResult<OpsTask>> {
  if (!isAiOpsEnabled()) return { ok: false, error: "feature_disabled" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("platform_ops_tasks")
    .update({
      status: "done",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", input.taskId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "update_failed" };
  await audit("task_completed", input.actorId, "task", input.taskId);
  return { ok: true, data: mapTask(data) };
}

export function buildOpsExportReport(input: {
  health: PlatformHealthSnapshot;
  alerts: PlatformAlert[];
  insights: AiOpsInsight[];
  trends: PlatformTrend[];
}): string {
  const lines = [
    "# Dalily AI Ops Report",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Health",
    `System: ${input.health.systemHealth} (${input.health.overallScore}/100)`,
    `Active users: ${input.health.activeUsers}`,
    `Bookings today: ${input.health.bookingsToday}`,
    `Open cases: ${input.health.openCases}`,
    `Fraud alerts: ${input.health.fraudAlerts}`,
    `Payment success: ${input.health.paymentSuccessRate ?? "n/a"}`,
    `Refund rate: ${input.health.refundRate ?? "n/a"}`,
    "",
    "## Insights",
    ...input.insights.map((i) => `- [${i.tone}] ${i.message}`),
    "",
    "## Open alerts",
    ...input.alerts
      .filter((a) => a.status === "open" || a.status === "acknowledged")
      .map((a) => `- ${a.severity}: ${a.title}`),
    "",
    "## Weekly trends",
    ...input.trends
      .filter((t) => t.period === "weekly")
      .map(
        (t) =>
          `- ${t.metricKey}: ${t.value} (${t.changePct ?? 0}% ${t.direction})`,
      ),
  ];
  return lines.join("\n");
}
