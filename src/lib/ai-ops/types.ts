/** Sprint 7 Phase 6 — AI Operations & Platform Health types */

export const OPS_PERIODS = [
  "realtime",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;
export type OpsPeriod = (typeof OPS_PERIODS)[number];

export const TREND_PERIODS = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];

export const ANOMALY_TYPES = [
  "refund_spike",
  "review_spike",
  "booking_drop",
  "category_anomaly",
  "regional_anomaly",
  "payment_anomaly",
  "complaint_spike",
  "verification_failures",
  "fraud_spike",
  "other",
] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export const ALERT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export type SystemHealthLevel = "healthy" | "degraded" | "critical";

export type PlatformHealthSnapshot = {
  id?: string;
  snapshotAt: string;
  period: OpsPeriod;
  activeUsers: number;
  bookingsToday: number;
  completedJobs: number;
  openCases: number;
  escalatedCases: number;
  fraudAlerts: number;
  trustDistribution: Record<string, number>;
  verificationPending: number;
  verificationVerified: number;
  reviewCountPeriod: number;
  paymentSuccessRate: number | null;
  refundRate: number | null;
  systemHealth: SystemHealthLevel;
  overallScore: number;
};

export type PlatformAnomaly = {
  id: string;
  anomalyType: AnomalyType;
  severity: AlertSeverity;
  title: string;
  summary: string | null;
  metricKey: string | null;
  baselineValue: number | null;
  currentValue: number | null;
  deviationPct: number | null;
  scopeType: string | null;
  scopeId: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  falsePositive: boolean;
};

export type PlatformAlert = {
  id: string;
  alertKey: string;
  title: string;
  body: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  source: "rule" | "anomaly" | "manual" | "system";
  anomalyId: string | null;
  thresholdValue: number | null;
  currentValue: number | null;
  assignedAdminId: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type PlatformTrend = {
  id: string;
  metricKey: string;
  period: TrendPeriod;
  periodStart: string;
  periodEnd: string;
  value: number;
  previousValue: number | null;
  changePct: number | null;
  direction: "up" | "down" | "stable";
  scopeType: string;
  scopeId: string | null;
};

export type CategoryHealth = {
  categoryId: string;
  categoryName: string | null;
  trustLevel: string;
  growthPct: number | null;
  complaintRate: number | null;
  cancellationRate: number | null;
  averageRating: number | null;
  completionRate: number | null;
  customerSatisfaction: number | null;
  bookingCount: number;
  providerCount: number;
  healthScore: number;
};

export type RegionHealth = {
  regionKey: string;
  regionName: string | null;
  providerDensity: number;
  demandCount: number;
  avgResponseHours: number | null;
  complaintRate: number | null;
  trustDistribution: Record<string, number>;
  bookingCount: number;
  healthScore: number;
};

export type OpsTask = {
  id: string;
  title: string;
  body: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assignedAdminId: string | null;
  createdBy: string | null;
  alertId: string | null;
  relatedHref: string | null;
  createdAt: string;
};

export type AiOpsInsight = {
  id: string;
  tone: "positive" | "neutral" | "warning" | "critical";
  message: string;
  metricKey?: string;
  changePct?: number | null;
};

/** Default alert thresholds (configurable via metadata later). */
export const DEFAULT_ALERT_THRESHOLDS = {
  complaintRate: 0.08,
  refundRate: 0.12,
  fraudSpikeCount: 5,
  verificationBacklog: 25,
  paymentSuccessMin: 0.85,
} as const;

export const AI_OPS_MODEL_VERSION = "ai-ops-v1";
