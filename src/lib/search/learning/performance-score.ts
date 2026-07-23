import type { VerificationStatus } from "@/types/database.types";
import type { ProviderPerformanceRow } from "./types";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function verificationFactor(status: VerificationStatus): number {
  switch (status) {
    case "verified":
      return 1;
    case "partially_verified":
      return 0.75;
    case "pending":
      return 0.5;
    default:
      return 0.25;
  }
}

export type PerformanceComputeInput = {
  providerId: string;
  verificationStatus: VerificationStatus;
  profileCompleteness: number;
  ratingAvg: number;
  reviewCount: number;
  requests: Array<{
    status: string;
    customer_id: string;
    response_time_seconds: number | null;
    created_at: string;
    accepted_at: string | null;
    rejected_at: string | null;
  }>;
};

/**
 * Pure AI Performance Score from marketplace outcomes + profile trust signals.
 */
export function computeProviderPerformance(
  input: PerformanceComputeInput,
): Omit<ProviderPerformanceRow, "computedAt"> {
  const requests = input.requests;
  const sampleSize = requests.length;

  const acceptedLike = requests.filter((r) =>
    [
      "accepted",
      "quoted",
      "quote_accepted",
      "quote_declined",
      "in_progress",
      "completed_by_business",
      "completed",
      "reviewed",
    ].includes(r.status),
  );
  const rejected = requests.filter((r) => r.status === "rejected");
  const completed = requests.filter((r) =>
    ["completed", "reviewed", "completed_by_business"].includes(r.status),
  );
  const cancelled = requests.filter((r) => r.status === "cancelled");
  const successful = requests.filter((r) =>
    ["completed", "reviewed"].includes(r.status),
  );

  const acceptanceDenom = acceptedLike.length + rejected.length;
  const acceptanceRate =
    acceptanceDenom > 0 ? acceptedLike.length / acceptanceDenom : null;

  const completionRate =
    acceptedLike.length > 0 ? completed.length / acceptedLike.length : null;

  const cancellationRate =
    sampleSize > 0 ? cancelled.length / sampleSize : null;

  const customerCounts = new Map<string, number>();
  for (const r of successful) {
    customerCounts.set(r.customer_id, (customerCounts.get(r.customer_id) ?? 0) + 1);
  }
  const uniqueCustomers = customerCounts.size;
  const repeatCustomers = [...customerCounts.values()].filter((c) => c > 1).length;
  const repeatCustomerRate =
    uniqueCustomers > 0 ? repeatCustomers / uniqueCustomers : null;

  const responseSeconds = requests
    .map((r) => r.response_time_seconds)
    .filter((s): s is number => s != null && Number.isFinite(s) && s >= 0);
  const avgResponseHours =
    responseSeconds.length > 0
      ? responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length / 3600
      : null;

  const fAcceptance = acceptanceRate == null ? 0.5 : clamp01(acceptanceRate);
  const fCompletion = completionRate == null ? 0.5 : clamp01(completionRate);
  const fRating =
    input.reviewCount > 0 ? clamp01(Number(input.ratingAvg) / 5) : 0.5;
  const fResponse =
    avgResponseHours == null
      ? 0.5
      : clamp01(1 - avgResponseHours / 48);
  const fCancel =
    cancellationRate == null ? 0.5 : clamp01(1 - cancellationRate);
  const fRepeat =
    repeatCustomerRate == null ? 0.45 : clamp01(0.4 + repeatCustomerRate * 0.6);
  const fJobs = clamp01(Math.log10(1 + successful.length) / 2.5);
  const fCompleteness = clamp01(input.profileCompleteness / 100);
  const fVerification = verificationFactor(input.verificationStatus);

  const factors = {
    acceptance: fAcceptance,
    completion: fCompletion,
    rating: fRating,
    response: fResponse,
    cancellation: fCancel,
    repeat: fRepeat,
    jobs: fJobs,
    completeness: fCompleteness,
    verification: fVerification,
  };

  const performanceScore = clamp01(
    fAcceptance * 0.16 +
      fCompletion * 0.18 +
      fRating * 0.14 +
      fResponse * 0.12 +
      fCancel * 0.1 +
      fRepeat * 0.08 +
      fJobs * 0.08 +
      fCompleteness * 0.07 +
      fVerification * 0.07,
  );

  const dataQuality = clamp01(
    Math.min(1, sampleSize / 25) * 0.55 +
      (acceptanceDenom > 0 ? 0.2 : 0) +
      (successful.length > 0 ? 0.15 : 0) +
      (responseSeconds.length > 0 ? 0.1 : 0),
  );

  return {
    providerId: input.providerId,
    performanceScore: Math.round(performanceScore * 10000) / 10000,
    acceptanceRate:
      acceptanceRate == null ? null : Math.round(acceptanceRate * 10000) / 10000,
    completionRate:
      completionRate == null ? null : Math.round(completionRate * 10000) / 10000,
    avgRating:
      input.reviewCount > 0
        ? Math.round(Number(input.ratingAvg) * 100) / 100
        : null,
    avgResponseHours:
      avgResponseHours == null
        ? null
        : Math.round(avgResponseHours * 100) / 100,
    cancellationRate:
      cancellationRate == null
        ? null
        : Math.round(cancellationRate * 10000) / 10000,
    repeatCustomerRate:
      repeatCustomerRate == null
        ? null
        : Math.round(repeatCustomerRate * 10000) / 10000,
    successfulJobs: successful.length,
    sampleSize,
    dataQuality: Math.round(dataQuality * 10000) / 10000,
    factors,
  };
}
