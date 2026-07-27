/**
 * AI operational insights — short natural-language summaries for admins.
 */

import type { LivePlatformCounters } from "@/lib/ai-ops/collect";
import type { PlatformHealthSnapshot, PlatformTrend, AiOpsInsight } from "@/lib/ai-ops/types";

export function generateAiOpsInsights(input: {
  counters: LivePlatformCounters;
  health: PlatformHealthSnapshot;
  trends: Array<Pick<PlatformTrend, "metricKey" | "period" | "changePct" | "direction">>;
}): AiOpsInsight[] {
  const insights: AiOpsInsight[] = [];
  const weekly = input.trends.filter((t) => t.period === "weekly");

  const bookings = weekly.find((t) => t.metricKey === "bookings");
  if (bookings?.changePct != null) {
    insights.push({
      id: "bookings_week",
      tone: bookings.direction === "up" ? "positive" : bookings.direction === "down" ? "warning" : "neutral",
      message:
        bookings.direction === "up"
          ? `Bookings increased by ${Math.abs(bookings.changePct)}% this week.`
          : bookings.direction === "down"
            ? `Bookings decreased by ${Math.abs(bookings.changePct)}% this week.`
            : "Bookings are stable week over week.",
      metricKey: "bookings",
      changePct: bookings.changePct,
    });
  }

  const complaints = weekly.find((t) => t.metricKey === "complaints");
  if (complaints?.changePct != null && complaints.direction === "up") {
    insights.push({
      id: "complaints_week",
      tone: "warning",
      message: `Complaint rate increased this week (${complaints.changePct > 0 ? "+" : ""}${complaints.changePct}%).`,
      metricKey: "complaints",
      changePct: complaints.changePct,
    });
  } else if (complaints?.direction === "down") {
    insights.push({
      id: "complaints_improved",
      tone: "positive",
      message: "Complaint volume improved versus last week.",
      metricKey: "complaints",
      changePct: complaints.changePct,
    });
  }

  if (input.counters.fraudAlerts <= 2) {
    insights.push({
      id: "fraud_stable",
      tone: "positive",
      message: "Fraud alerts remain stable.",
      metricKey: "fraud_alerts",
    });
  } else {
    insights.push({
      id: "fraud_elevated",
      tone: "critical",
      message: `${input.counters.fraudAlerts} fraud alerts need review.`,
      metricKey: "fraud_alerts",
    });
  }

  if (
    input.health.paymentSuccessRate != null &&
    input.health.paymentSuccessRate >= 0.95
  ) {
    insights.push({
      id: "payments_healthy",
      tone: "positive",
      message: "Payment success rate is healthy.",
      metricKey: "payment_success_rate",
    });
  }

  if (input.counters.verificationPending > 0 && input.counters.verificationPending < 10) {
    insights.push({
      id: "verification_ok",
      tone: "neutral",
      message: "Verification queue is manageable.",
      metricKey: "verification_pending",
    });
  }

  // Category heuristic
  const sparse = input.counters.categories.find(
    (c) => c.providers >= 5 && c.name.toLowerCase().includes("clean"),
  );
  if (sparse && input.counters.complaintsWeek > input.counters.complaintsPrevWeek) {
    insights.push({
      id: "category_cleaning",
      tone: "warning",
      message: `High cancellation / complaint pressure may affect ${sparse.name}.`,
      metricKey: "category_health",
    });
  }

  if (
    input.health.systemHealth === "healthy" &&
    insights.filter((i) => i.tone === "warning" || i.tone === "critical").length === 0
  ) {
    insights.push({
      id: "ops_healthy",
      tone: "positive",
      message: "Provider response and platform quality signals look steady.",
    });
  }

  return insights.slice(0, 8);
}
