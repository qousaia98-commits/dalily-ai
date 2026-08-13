/** Row mappers for AI Ops */

import type {
  CategoryHealth,
  OpsTask,
  PlatformAlert,
  PlatformAnomaly,
  PlatformHealthSnapshot,
  PlatformTrend,
  RegionHealth,
  AnomalyType,
  AlertSeverity,
  AlertStatus,
  TrendPeriod,
  OpsPeriod,
  SystemHealthLevel,
} from "@/lib/ai-ops/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapHealth(row: any): PlatformHealthSnapshot {
  return {
    id: row.id,
    snapshotAt: row.snapshot_at,
    period: row.period as OpsPeriod,
    activeUsers: row.active_users,
    bookingsToday: row.bookings_today,
    completedJobs: row.completed_jobs,
    openCases: row.open_cases,
    escalatedCases: row.escalated_cases,
    fraudAlerts: row.fraud_alerts,
    trustDistribution: (row.trust_distribution as Record<string, number>) ?? {},
    verificationPending: row.verification_pending,
    verificationVerified: row.verification_verified,
    reviewCountPeriod: row.review_count_period,
    paymentSuccessRate:
      row.payment_success_rate != null ? Number(row.payment_success_rate) : null,
    refundRate: row.refund_rate != null ? Number(row.refund_rate) : null,
    systemHealth: row.system_health as SystemHealthLevel,
    overallScore: Number(row.overall_score),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAnomaly(row: any): PlatformAnomaly {
  return {
    id: row.id,
    anomalyType: row.anomaly_type as AnomalyType,
    severity: row.severity as AlertSeverity,
    title: row.title,
    summary: row.summary,
    metricKey: row.metric_key,
    baselineValue: row.baseline_value != null ? Number(row.baseline_value) : null,
    currentValue: row.current_value != null ? Number(row.current_value) : null,
    deviationPct: row.deviation_pct != null ? Number(row.deviation_pct) : null,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at,
    falsePositive: Boolean(row.false_positive),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAlert(row: any): PlatformAlert {
  return {
    id: row.id,
    alertKey: row.alert_key,
    title: row.title,
    body: row.body,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    source: row.source,
    anomalyId: row.anomaly_id,
    thresholdValue:
      row.threshold_value != null ? Number(row.threshold_value) : null,
    currentValue: row.current_value != null ? Number(row.current_value) : null,
    assignedAdminId: row.assigned_admin_id,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTrend(row: any): PlatformTrend {
  return {
    id: row.id,
    metricKey: row.metric_key,
    period: row.period as TrendPeriod,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    value: Number(row.value),
    previousValue: row.previous_value != null ? Number(row.previous_value) : null,
    changePct: row.change_pct != null ? Number(row.change_pct) : null,
    direction: row.direction,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCategoryHealth(row: any): CategoryHealth {
  return {
    categoryId: row.category_id,
    categoryName: row.category_name,
    trustLevel: row.trust_level,
    growthPct: row.growth_pct != null ? Number(row.growth_pct) : null,
    complaintRate: row.complaint_rate != null ? Number(row.complaint_rate) : null,
    cancellationRate:
      row.cancellation_rate != null ? Number(row.cancellation_rate) : null,
    averageRating: row.average_rating != null ? Number(row.average_rating) : null,
    completionRate:
      row.completion_rate != null ? Number(row.completion_rate) : null,
    customerSatisfaction:
      row.customer_satisfaction != null ? Number(row.customer_satisfaction) : null,
    bookingCount: row.booking_count,
    providerCount: row.provider_count,
    healthScore: Number(row.health_score),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRegionHealth(row: any): RegionHealth {
  return {
    regionKey: row.region_key,
    regionName: row.region_name,
    providerDensity: row.provider_density,
    demandCount: row.demand_count,
    avgResponseHours:
      row.avg_response_hours != null ? Number(row.avg_response_hours) : null,
    complaintRate: row.complaint_rate != null ? Number(row.complaint_rate) : null,
    trustDistribution: (row.trust_distribution as Record<string, number>) ?? {},
    bookingCount: row.booking_count,
    healthScore: Number(row.health_score),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTask(row: any): OpsTask {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    priority: row.priority,
    assignedAdminId: row.assigned_admin_id,
    createdBy: row.created_by,
    alertId: row.alert_id,
    relatedHref: row.related_href,
    createdAt: row.created_at,
  };
}
