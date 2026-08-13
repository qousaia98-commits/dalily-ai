import type { SignalCollector, SignalCollectorContext } from "@/lib/reputation/types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function bool01(v: boolean): number {
  return v ? 1 : 0;
}

function rateOr(v: number | null | undefined, fallback = 0.5): number {
  if (v == null || !Number.isFinite(v)) return fallback;
  return clamp01(v);
}

function invRate(v: number | null | undefined, fallback = 0.55): number {
  if (v == null || !Number.isFinite(v)) return fallback;
  return clamp01(1 - v);
}

/**
 * Modular signal collectors. Add future signals here without touching engine core.
 * ML adapters can wrap computeNormalized later.
 */
export const SIGNAL_COLLECTORS: SignalCollector[] = [
  {
    signalKey: "identity_verified",
    category: "verification",
    computeNormalized: (ctx) => ({
      rawValue: bool01(ctx.raw.identityVerified),
      normalizedValue: bool01(ctx.raw.identityVerified),
    }),
  },
  {
    signalKey: "address_verified",
    category: "verification",
    computeNormalized: (ctx) => ({
      rawValue: bool01(ctx.raw.addressVerified),
      normalizedValue: bool01(ctx.raw.addressVerified),
    }),
  },
  {
    signalKey: "business_verified",
    category: "verification",
    computeNormalized: (ctx) => {
      const s = ctx.raw.verificationStatus;
      const n =
        s === "verified" ? 1 : s === "partially_verified" ? 0.7 : s === "pending" ? 0.4 : 0.15;
      return { rawValue: n, normalizedValue: n };
    },
  },
  {
    signalKey: "professional_verified",
    category: "verification",
    computeNormalized: (ctx) => ({
      rawValue: bool01(ctx.raw.professionalVerified),
      normalizedValue: bool01(ctx.raw.professionalVerified),
    }),
  },
  {
    signalKey: "document_freshness",
    category: "verification",
    computeNormalized: (ctx) => {
      const d = ctx.raw.documentFreshnessDays;
      if (d == null) return { rawValue: null, normalizedValue: 0.45 };
      return { rawValue: d, normalizedValue: clamp01(1 - d / 365) };
    },
  },
  {
    signalKey: "average_rating",
    category: "reviews",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.ratingAvg,
      normalizedValue: clamp01(ctx.raw.ratingAvg / 5),
    }),
  },
  {
    signalKey: "review_count",
    category: "reviews",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.reviewCount,
      normalizedValue: clamp01(Math.log10(1 + ctx.raw.reviewCount) / 2.2),
    }),
  },
  {
    signalKey: "recommendation_rate",
    category: "reviews",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.recommendationRate,
      normalizedValue: rateOr(ctx.raw.recommendationRate, 0.5),
    }),
  },
  {
    signalKey: "recent_reviews",
    category: "reviews",
    computeNormalized: (ctx) => {
      const recent = ctx.raw.recentRatingAvg ?? ctx.raw.ratingAvg;
      return { rawValue: recent, normalizedValue: clamp01(recent / 5) };
    },
  },
  {
    signalKey: "provider_response_rate",
    category: "reviews",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.providerResponseRate,
      normalizedValue: rateOr(ctx.raw.providerResponseRate, 0.45),
    }),
  },
  {
    signalKey: "review_quality",
    category: "reviews",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.reviewQuality,
      normalizedValue: rateOr(ctx.raw.reviewQuality, 0.45),
    }),
  },
  {
    signalKey: "completed_jobs",
    category: "booking",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.completedJobs,
      normalizedValue: clamp01(Math.log10(1 + ctx.raw.completedJobs) / 2.5),
    }),
  },
  {
    signalKey: "cancelled_jobs",
    category: "booking",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.cancelledJobs,
      normalizedValue: clamp01(1 - Math.min(ctx.raw.cancelledJobs, 20) / 20),
    }),
  },
  {
    signalKey: "cancellation_rate",
    category: "booking",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.cancellationRate,
      normalizedValue: invRate(ctx.raw.cancellationRate, 0.6),
    }),
  },
  {
    signalKey: "acceptance_rate",
    category: "booking",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.acceptanceRate,
      normalizedValue: rateOr(ctx.raw.acceptanceRate, 0.55),
    }),
  },
  {
    signalKey: "completion_rate",
    category: "booking",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.completionRate,
      normalizedValue: rateOr(ctx.raw.completionRate, 0.55),
    }),
  },
  {
    signalKey: "repeat_customers",
    category: "booking",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.repeatCustomerRate,
      normalizedValue: rateOr(ctx.raw.repeatCustomerRate, 0.4),
    }),
  },
  {
    signalKey: "avg_booking_value",
    category: "booking",
    computeNormalized: (ctx) => {
      const v = ctx.raw.avgBookingValue;
      if (v == null) return { rawValue: null, normalizedValue: 0.45 };
      return { rawValue: v, normalizedValue: clamp01(Math.log10(1 + v) / 4) };
    },
  },
  {
    signalKey: "avg_response_time",
    category: "communication",
    computeNormalized: (ctx) => {
      const h = ctx.raw.avgResponseHours;
      if (h == null) return { rawValue: null, normalizedValue: 0.45 };
      return { rawValue: h, normalizedValue: clamp01(1 - Math.min(h, 48) / 48) };
    },
  },
  {
    signalKey: "response_consistency",
    category: "communication",
    computeNormalized: (ctx) => {
      const h = ctx.raw.avgResponseHours;
      const late = ctx.raw.lateReplyRate;
      const speed = h == null ? 0.5 : clamp01(1 - Math.min(h, 36) / 36);
      const lateScore = invRate(late, 0.55);
      return { rawValue: null, normalizedValue: clamp01(speed * 0.6 + lateScore * 0.4) };
    },
  },
  {
    signalKey: "unread_requests",
    category: "communication",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.unreadRequests,
      normalizedValue: clamp01(1 - Math.min(ctx.raw.unreadRequests, 10) / 10),
    }),
  },
  {
    signalKey: "late_replies",
    category: "communication",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.lateReplyRate,
      normalizedValue: invRate(ctx.raw.lateReplyRate, 0.55),
    }),
  },
  {
    signalKey: "on_time_arrival",
    category: "reliability",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.onTimeRate,
      normalizedValue: rateOr(ctx.raw.onTimeRate, 0.55),
    }),
  },
  {
    signalKey: "customer_confirmations",
    category: "reliability",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.customerConfirmationRate,
      normalizedValue: rateOr(ctx.raw.customerConfirmationRate, 0.55),
    }),
  },
  {
    signalKey: "complaint_rate",
    category: "reliability",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.complaintRate,
      normalizedValue: invRate(ctx.raw.complaintRate, 0.7),
    }),
  },
  {
    signalKey: "refund_rate",
    category: "reliability",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.refundRate,
      normalizedValue: invRate(ctx.raw.refundRate, 0.7),
    }),
  },
  {
    signalKey: "disputes",
    category: "reliability",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.disputeCount,
      normalizedValue: clamp01(1 - Math.min(ctx.raw.disputeCount, 8) / 8),
    }),
  },
  {
    signalKey: "policy_violations",
    category: "reliability",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.policyViolationCount,
      normalizedValue: clamp01(1 - Math.min(ctx.raw.policyViolationCount, 5) / 5),
    }),
  },
  {
    signalKey: "profile_completeness",
    category: "activity",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.profileCompleteness,
      normalizedValue: clamp01(ctx.raw.profileCompleteness / 100),
    }),
  },
  {
    signalKey: "recent_activity",
    category: "activity",
    computeNormalized: (ctx) => {
      if (!ctx.raw.updatedAt) return { rawValue: null, normalizedValue: 0.4 };
      const days =
        (Date.now() - new Date(ctx.raw.updatedAt).getTime()) / 86_400_000;
      return { rawValue: days, normalizedValue: clamp01(1 - days / 60) };
    },
  },
  {
    signalKey: "login_frequency",
    category: "activity",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.loginFrequencyScore,
      normalizedValue: rateOr(ctx.raw.loginFrequencyScore, 0.4),
    }),
  },
  {
    signalKey: "business_age",
    category: "activity",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.accountAgeDays,
      normalizedValue: clamp01(ctx.raw.accountAgeDays / 365),
    }),
  },
  {
    signalKey: "marketplace_engagement",
    category: "activity",
    computeNormalized: (ctx) => ({
      rawValue: ctx.raw.marketplaceEngagement,
      normalizedValue: rateOr(ctx.raw.marketplaceEngagement, 0.45),
    }),
  },
];

export function getCollectorMap(): Map<string, SignalCollector> {
  return new Map(SIGNAL_COLLECTORS.map((c) => [c.signalKey, c]));
}

/** ML adapter hook: replace a single collector without touching the engine. */
export function withMlSignalOverride(
  base: SignalCollector[],
  signalKey: string,
  computeNormalized: SignalCollector["computeNormalized"],
): SignalCollector[] {
  return base.map((c) =>
    c.signalKey === signalKey
      ? { ...c, computeNormalized: (ctx: SignalCollectorContext) => {
          const r = computeNormalized(ctx);
          return { ...r, metadata: { ...r.metadata, ml: true } };
        } }
      : c,
  );
}
