/**
 * Health model — score + system level from live counters.
 */

import type { LivePlatformCounters } from "@/lib/ai-ops/collect";
import type {
  PlatformHealthSnapshot,
  SystemHealthLevel,
} from "@/lib/ai-ops/types";

export function buildHealthSnapshot(
  counters: LivePlatformCounters,
): PlatformHealthSnapshot {
  const paymentSuccessRate =
    counters.paymentsTotal > 0
      ? Math.round((counters.paymentsPaid / counters.paymentsTotal) * 10000) / 10000
      : null;
  const refundRate =
    counters.paymentsWeek > 0
      ? Math.round((counters.refundsWeek / counters.paymentsWeek) * 10000) / 10000
      : counters.refundsWeek > 0
        ? 1
        : 0;

  let score = 80;
  if (counters.escalatedCases > 0) score -= Math.min(20, counters.escalatedCases * 3);
  if (counters.fraudAlerts > 3) score -= Math.min(20, counters.fraudAlerts * 2);
  if (counters.openCases > 20) score -= 10;
  if (paymentSuccessRate != null && paymentSuccessRate < 0.85) score -= 15;
  if (refundRate > 0.12) score -= 12;
  if (counters.verificationPending > 25) score -= 8;
  score = Math.max(0, Math.min(100, score));

  const systemHealth: SystemHealthLevel =
    score < 45 ? "critical" : score < 70 ? "degraded" : "healthy";

  return {
    snapshotAt: new Date().toISOString(),
    period: "realtime",
    activeUsers: counters.activeUsers,
    bookingsToday: counters.bookingsToday,
    completedJobs: counters.completedJobs,
    openCases: counters.openCases,
    escalatedCases: counters.escalatedCases,
    fraudAlerts: counters.fraudAlerts,
    trustDistribution: counters.trustDistribution,
    verificationPending: counters.verificationPending,
    verificationVerified: counters.verificationVerified,
    reviewCountPeriod: counters.reviewCountWeek,
    paymentSuccessRate,
    refundRate,
    systemHealth,
    overallScore: score,
  };
}
