/**
 * Anomaly detection — unusual spikes / drops vs baseline.
 */

import type { LivePlatformCounters } from "@/lib/ai-ops/collect";
import type { AnomalyType, AlertSeverity, PlatformAnomaly } from "@/lib/ai-ops/types";

type Detected = Omit<
  PlatformAnomaly,
  "id" | "detectedAt" | "resolvedAt" | "falsePositive"
>;

function severityFromDeviation(absPct: number): AlertSeverity {
  if (absPct >= 80) return "critical";
  if (absPct >= 50) return "high";
  if (absPct >= 25) return "medium";
  return "low";
}

function spike(
  type: AnomalyType,
  title: string,
  metricKey: string,
  current: number,
  baseline: number,
  minBaseline = 2,
): Detected | null {
  if (baseline < minBaseline && current < minBaseline + 2) return null;
  const base = Math.max(baseline, 1);
  const deviationPct = Math.round(((current - base) / base) * 1000) / 10;
  if (deviationPct < 40 && !(baseline === 0 && current >= 5)) return null;
  return {
    anomalyType: type,
    severity: severityFromDeviation(Math.abs(deviationPct)),
    title,
    summary: `${metricKey}: ${current} vs baseline ${baseline} (${deviationPct > 0 ? "+" : ""}${deviationPct}%)`,
    metricKey,
    baselineValue: baseline,
    currentValue: current,
    deviationPct,
    scopeType: "platform",
    scopeId: null,
  };
}

function drop(
  type: AnomalyType,
  title: string,
  metricKey: string,
  current: number,
  baseline: number,
): Detected | null {
  if (baseline < 5) return null;
  const deviationPct = Math.round(((current - baseline) / baseline) * 1000) / 10;
  if (deviationPct > -35) return null;
  return {
    anomalyType: type,
    severity: severityFromDeviation(Math.abs(deviationPct)),
    title,
    summary: `${metricKey}: ${current} vs baseline ${baseline} (${deviationPct}%)`,
    metricKey,
    baselineValue: baseline,
    currentValue: current,
    deviationPct,
    scopeType: "platform",
    scopeId: null,
  };
}

export function detectAnomalies(counters: LivePlatformCounters): Detected[] {
  const found: Detected[] = [];

  const refundBase = Math.max(1, Math.round(counters.paymentsWeek * 0.05));
  const refund = spike(
    "refund_spike",
    "Sudden refund spike",
    "refunds",
    counters.refundsWeek,
    refundBase,
  );
  if (refund) found.push(refund);

  const reviews = spike(
    "review_spike",
    "Unusual review volume",
    "reviews",
    counters.reviewCountWeek,
    Math.max(counters.reviewCountPrevWeek, 1),
  );
  if (reviews) found.push(reviews);

  const bookings = drop(
    "booking_drop",
    "Booking volume drop",
    "bookings",
    counters.bookingsWeek,
    counters.bookingsPrevWeek,
  );
  if (bookings) found.push(bookings);

  const complaints = spike(
    "complaint_spike",
    "Complaint rate spike",
    "complaints",
    counters.complaintsWeek,
    Math.max(counters.complaintsPrevWeek, 1),
  );
  if (complaints) found.push(complaints);

  if (counters.fraudAlerts >= 5) {
    found.push({
      anomalyType: "fraud_spike",
      severity: counters.fraudAlerts >= 10 ? "critical" : "high",
      title: "Fraud alert spike",
      summary: `${counters.fraudAlerts} open fraud alerts this week`,
      metricKey: "fraud_alerts",
      baselineValue: 3,
      currentValue: counters.fraudAlerts,
      deviationPct: Math.round(((counters.fraudAlerts - 3) / 3) * 1000) / 10,
      scopeType: "platform",
      scopeId: null,
    });
  }

  if (counters.verificationPending >= 25) {
    found.push({
      anomalyType: "verification_failures",
      severity: counters.verificationPending >= 50 ? "high" : "medium",
      title: "Verification backlog",
      summary: `${counters.verificationPending} providers awaiting verification`,
      metricKey: "verification_pending",
      baselineValue: 15,
      currentValue: counters.verificationPending,
      deviationPct:
        Math.round(
          ((counters.verificationPending - 15) / 15) * 1000,
        ) / 10,
      scopeType: "platform",
      scopeId: null,
    });
  }

  const paymentRate =
    counters.paymentsTotal > 0
      ? counters.paymentsPaid / counters.paymentsTotal
      : 1;
  if (counters.paymentsTotal >= 5 && paymentRate < 0.85) {
    found.push({
      anomalyType: "payment_anomaly",
      severity: paymentRate < 0.7 ? "critical" : "high",
      title: "Payment success anomaly",
      summary: `Success rate ${(paymentRate * 100).toFixed(1)}% this week`,
      metricKey: "payment_success_rate",
      baselineValue: 0.95,
      currentValue: Math.round(paymentRate * 10000) / 10000,
      deviationPct: Math.round((paymentRate - 0.95) * 1000) / 10,
      scopeType: "platform",
      scopeId: null,
    });
  }

  // Category / regional heuristics from sparse density
  for (const cat of counters.categories) {
    if (cat.providers >= 8 && cat.bookings === 0) {
      found.push({
        anomalyType: "category_anomaly",
        severity: "medium",
        title: `Low demand in ${cat.name}`,
        summary: `${cat.providers} providers but no recent bookings detected`,
        metricKey: "category_bookings",
        baselineValue: cat.providers,
        currentValue: cat.bookings,
        deviationPct: -100,
        scopeType: "category",
        scopeId: cat.id,
      });
    }
  }

  for (const region of counters.regions) {
    if (region.providers === 0 && region.bookings > 5) {
      found.push({
        anomalyType: "regional_anomaly",
        severity: "medium",
        title: `Demand without supply in ${region.name}`,
        summary: `${region.bookings} bookings vs 0 providers`,
        metricKey: "region_density",
        baselineValue: region.bookings,
        currentValue: 0,
        deviationPct: -100,
        scopeType: "region",
        scopeId: region.key,
      });
    }
  }

  return found;
}
