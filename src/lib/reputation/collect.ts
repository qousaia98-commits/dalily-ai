/**
 * Collect raw reputation inputs from existing Dalily tables.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderReputationRaw } from "@/lib/reputation/types";

export async function collectProviderReputationRaw(
  providerId: string,
): Promise<ProviderReputationRaw | null> {
  const admin = createAdminClient();

  const { data: provider } = await admin
    .from("providers")
    .select(
      "id, verification_status, rating_avg, review_count, trust_score, profile_completeness, updated_at, created_at, response_time_hours",
    )
    .eq("id", providerId)
    .maybeSingle();

  if (!provider) return null;

  const [
    checks,
    reviews,
    bookings,
    perf,
    reputationCache,
    refunds,
    disputes,
  ] = await Promise.all([
    loadVerificationChecks(providerId),
    admin
      .from("service_reviews")
      .select(
        "rating, recommend, provider_reply, comment, created_at, is_verified, status, deleted_at",
      )
      .eq("provider_id", providerId)
      .is("deleted_at", null),
    admin
      .from("bookings")
      .select("status, customer_id, customer_confirmed_at")
      .eq("provider_id", providerId)
      .is("deleted_at", null),
    admin
      .from("provider_performance_scores")
      .select(
        "completion_rate, cancellation_rate, acceptance_rate, avg_response_hours, repeat_customer_rate, successful_jobs",
      )
      .eq("provider_id", providerId)
      .maybeSingle(),
    admin
      .from("provider_reputation_cache")
      .select("recommendation_rate, response_rate")
      .eq("provider_id", providerId)
      .maybeSingle(),
    safeCountRefunds(providerId),
    safeCountDisputes(providerId),
  ]);

  const checkRows = checks;
  const approved = (t: string) =>
    checkRows.some(
      (c) =>
        (c.check_type === t || c.check_type?.includes(t)) &&
        (c.status === "approved" || c.status === "verified" || c.status === "passed"),
    );

  const identityVerified =
    approved("identity") || provider.verification_status === "verified";
  const addressVerified = approved("address");
  const professionalVerified = approved("professional") || approved("license");
  const businessVerified =
    provider.verification_status === "verified" || approved("business");

  let freshest: number | null = null;
  for (const c of checkRows) {
    if (!c.verified_at) continue;
    const days =
      (Date.now() - new Date(c.verified_at).getTime()) / 86_400_000;
    if (freshest == null || days < freshest) freshest = days;
  }

  const approvedReviews = (reviews.data ?? []).filter(
    (r) => r.status === "approved",
  );
  const reviewCount = approvedReviews.length;
  const ratingAvg =
    reviewCount > 0
      ? approvedReviews.reduce((s, r) => s + Number(r.rating), 0) / reviewCount
      : Number(provider.rating_avg ?? 0);
  const verifiedReviewCount = approvedReviews.filter((r) => r.is_verified).length;
  const recommendRows = approvedReviews.filter((r) => r.recommend != null);
  const recommendationRate =
    reputationCache.data?.recommendation_rate != null
      ? Number(reputationCache.data.recommendation_rate) / 100
      : recommendRows.length > 0
        ? recommendRows.filter((r) => r.recommend).length / recommendRows.length
        : null;
  const withReply = approvedReviews.filter((r) => r.provider_reply).length;
  const providerResponseRate =
    reputationCache.data?.response_rate != null
      ? Number(reputationCache.data.response_rate) / 100
      : reviewCount > 0
        ? withReply / reviewCount
        : null;

  const halfYear = Date.now() - 180 * 86_400_000;
  const recent = approvedReviews.filter(
    (r) => new Date(r.created_at).getTime() > halfYear,
  );
  const recentRatingAvg =
    recent.length > 0
      ? recent.reduce((s, r) => s + Number(r.rating), 0) / recent.length
      : null;

  const qualityScores = approvedReviews.map((r) => {
    const len = (r.comment ?? "").trim().length;
    return Math.min(1, len / 120);
  });
  const reviewQuality =
    qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : null;

  const bookingRows = bookings.data ?? [];
  const completedJobs = bookingRows.filter(
    (b) =>
      b.status === "completed" ||
      b.status === "customer_confirmed",
  ).length;
  const cancelledJobs = bookingRows.filter((b) => b.status === "cancelled").length;
  const confirmedCustomers = bookingRows.filter((b) => b.customer_confirmed_at).length;
  const customerConfirmationRate =
    completedJobs > 0 ? confirmedCustomers / Math.max(completedJobs, 1) : null;

  const values: number[] = [];
  const avgBookingValue =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const uniqueCustomers = new Set(bookingRows.map((b) => b.customer_id).filter(Boolean));
  const repeatProxy =
    uniqueCustomers.size > 0 && bookingRows.length > uniqueCustomers.size
      ? (bookingRows.length - uniqueCustomers.size) / bookingRows.length
      : perf.data?.repeat_customer_rate != null
        ? Number(perf.data.repeat_customer_rate)
        : null;

  const createdAt = provider.created_at;
  const accountAgeDays = createdAt
    ? Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000)
    : 0;

  const totalBookings = bookingRows.length;
  const complaintRate =
    totalBookings > 0
      ? bookingRows.filter((b) => b.status === "issue_reported").length / totalBookings
      : null;

  const refundRate =
    completedJobs > 0 ? Math.min(1, refunds / completedJobs) : refunds > 0 ? 0.2 : 0;

  return {
    verificationStatus: provider.verification_status ?? "unverified",
    identityVerified,
    addressVerified,
    businessVerified,
    professionalVerified,
    documentFreshnessDays: freshest,
    ratingAvg,
    reviewCount: reviewCount || (provider.review_count ?? 0),
    verifiedReviewCount,
    recommendationRate,
    recentRatingAvg,
    providerResponseRate,
    reviewQuality,
    completedJobs: Math.max(
      completedJobs,
      Number(perf.data?.successful_jobs ?? 0),
    ),
    cancelledJobs,
    cancellationRate:
      perf.data?.cancellation_rate != null
        ? Number(perf.data.cancellation_rate)
        : totalBookings > 0
          ? cancelledJobs / totalBookings
          : null,
    acceptanceRate:
      perf.data?.acceptance_rate != null
        ? Number(perf.data.acceptance_rate)
        : null,
    completionRate:
      perf.data?.completion_rate != null
        ? Number(perf.data.completion_rate)
        : totalBookings > 0
          ? completedJobs / totalBookings
          : null,
    repeatCustomerRate: repeatProxy,
    avgBookingValue,
    avgResponseHours:
      perf.data?.avg_response_hours != null
        ? Number(perf.data.avg_response_hours)
        : provider.response_time_hours != null
          ? Number(provider.response_time_hours)
          : null,
    unreadRequests: 0,
    lateReplyRate: null,
    onTimeRate: null,
    customerConfirmationRate,
    complaintRate,
    refundRate,
    disputeCount: disputes,
    policyViolationCount: 0,
    profileCompleteness: Number(provider.profile_completeness ?? 50),
    updatedAt: provider.updated_at,
    createdAt: provider.created_at,
    loginFrequencyScore: null,
    marketplaceEngagement: clamp01(
      Math.log10(1 + (reviewCount + completedJobs)) / 2.5,
    ),
    accountAgeDays,
  };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

async function loadVerificationChecks(providerId: string): Promise<
  Array<{ check_type?: string; status?: string; verified_at?: string | null }>
> {
  try {
    const admin = createAdminClient();
    // Table added in Sprint 7 Phase 1 — may be missing from generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("provider_verification_checks")
      .select("check_type, status, verified_at")
      .eq("provider_id", providerId);
    return data ?? [];
  } catch {
    return [];
  }
}

async function safeCountRefunds(providerId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (admin as any)
      .from("refund_requests")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .in("status", ["succeeded", "approved", "processing"]);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function safeCountDisputes(providerId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (admin as any)
      .from("payment_disputes")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId);
    return count ?? 0;
  } catch {
    return 0;
  }
}
