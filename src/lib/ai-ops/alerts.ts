/**
 * Alert engine — configurable thresholds → platform_alerts.
 */

import type { LivePlatformCounters } from "@/lib/ai-ops/collect";
import type { PlatformHealthSnapshot } from "@/lib/ai-ops/types";
import {
  DEFAULT_ALERT_THRESHOLDS,
  type AlertSeverity,
  type PlatformAlert,
} from "@/lib/ai-ops/types";

type AlertDraft = Omit<
  PlatformAlert,
  | "id"
  | "status"
  | "assignedAdminId"
  | "acknowledgedBy"
  | "acknowledgedAt"
  | "resolvedAt"
  | "createdAt"
  | "anomalyId"
> & { anomalyId?: string | null };

export function evaluateAlertRules(input: {
  counters: LivePlatformCounters;
  health: PlatformHealthSnapshot;
  thresholds?: Partial<typeof DEFAULT_ALERT_THRESHOLDS>;
}): AlertDraft[] {
  const t = { ...DEFAULT_ALERT_THRESHOLDS, ...input.thresholds };
  const alerts: AlertDraft[] = [];
  const complaintRate =
    input.counters.bookingsWeek > 0
      ? input.counters.complaintsWeek / input.counters.bookingsWeek
      : 0;

  if (complaintRate >= t.complaintRate) {
    alerts.push({
      alertKey: "complaint_rate_high",
      title: "Complaint rate above threshold",
      body: `Complaint rate ${(complaintRate * 100).toFixed(1)}% (threshold ${(t.complaintRate * 100).toFixed(0)}%)`,
      severity: complaintRate >= t.complaintRate * 1.5 ? "high" : "medium",
      source: "rule",
      anomalyId: null,
      thresholdValue: t.complaintRate,
      currentValue: Math.round(complaintRate * 10000) / 10000,
    });
  }

  if ((input.health.refundRate ?? 0) >= t.refundRate) {
    alerts.push({
      alertKey: "refund_rate_high",
      title: "Refund rate above threshold",
      body: `Refund rate ${((input.health.refundRate ?? 0) * 100).toFixed(1)}%`,
      severity: "high",
      source: "rule",
      anomalyId: null,
      thresholdValue: t.refundRate,
      currentValue: input.health.refundRate,
    });
  }

  if (input.counters.fraudAlerts >= t.fraudSpikeCount) {
    alerts.push({
      alertKey: "fraud_spike",
      title: "Fraud spike",
      body: `${input.counters.fraudAlerts} open fraud alerts this week`,
      severity: (input.counters.fraudAlerts >= t.fraudSpikeCount * 2
        ? "critical"
        : "high") as AlertSeverity,
      source: "rule",
      anomalyId: null,
      thresholdValue: t.fraudSpikeCount,
      currentValue: input.counters.fraudAlerts,
    });
  }

  if (
    input.health.paymentSuccessRate != null &&
    input.health.paymentSuccessRate < t.paymentSuccessMin &&
    input.counters.paymentsTotal >= 5
  ) {
    alerts.push({
      alertKey: "payment_outage",
      title: "Payment success below threshold",
      body: `Success rate ${((input.health.paymentSuccessRate ?? 0) * 100).toFixed(1)}%`,
      severity: "critical",
      source: "rule",
      anomalyId: null,
      thresholdValue: t.paymentSuccessMin,
      currentValue: input.health.paymentSuccessRate,
    });
  }

  if (input.counters.verificationPending >= t.verificationBacklog) {
    alerts.push({
      alertKey: "verification_backlog",
      title: "Verification backlog",
      body: `${input.counters.verificationPending} providers awaiting review`,
      severity: "medium",
      source: "rule",
      anomalyId: null,
      thresholdValue: t.verificationBacklog,
      currentValue: input.counters.verificationPending,
    });
  }

  if (input.health.systemHealth === "critical") {
    alerts.push({
      alertKey: "system_health_critical",
      title: "Platform health critical",
      body: `Overall ops score ${input.health.overallScore}/100`,
      severity: "critical",
      source: "system",
      anomalyId: null,
      thresholdValue: 45,
      currentValue: input.health.overallScore,
    });
  }

  // AI processing backlog placeholder — signals when escalated cases pile up
  if (input.counters.escalatedCases >= 8) {
    alerts.push({
      alertKey: "ai_processing_backlog",
      title: "AI / ops processing backlog",
      body: `${input.counters.escalatedCases} escalated quality cases need attention`,
      severity: "high",
      source: "system",
      anomalyId: null,
      thresholdValue: 8,
      currentValue: input.counters.escalatedCases,
    });
  }

  return alerts;
}
