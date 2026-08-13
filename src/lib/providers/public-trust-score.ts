/**
 * Enterprise public trust score (0–100).
 *
 * IMPORTANT: Only the final percentage may leave this module.
 * Do not export weights, intermediate signals, or formula details to clients/API.
 */

export type PublicTrustScoreInputs = {
  verified: boolean;
  partiallyVerified?: boolean;
  completedJobs: number;
  ratingAvg: number;
  reviewCount: number;
  cancellationRate: number | null;
  responseRate: number | null;
  profileCompleteness: number;
  /** Days since last provider activity (updated_at); null = unknown */
  daysSinceActivity: number | null;
};

/**
 * Returns a single public percentage. Implementation is intentionally opaque to callers.
 */
export function computePublicTrustScorePct(input: PublicTrustScoreInputs): number {
  // Weighted blend — keep internal; never serialize this structure to the client.
  const w = {
    verification: 0.22,
    jobs: 0.18,
    reviews: 0.2,
    cancellation: 0.12,
    response: 0.14,
    completeness: 0.08,
    activity: 0.06,
  };

  const verification =
    input.verified ? 1 : input.partiallyVerified ? 0.65 : 0.25;

  const jobs = Math.min(1, Math.log10(Math.max(1, input.completedJobs) + 1) / 2.2);

  const reviewQuality =
    input.reviewCount <= 0
      ? 0.35
      : Math.min(
          1,
          (Math.max(0, input.ratingAvg) / 5) *
            (0.55 + 0.45 * Math.min(1, input.reviewCount / 25)),
        );

  const cancellation =
    input.cancellationRate == null
      ? 0.7
      : Math.max(0, 1 - Math.min(1, input.cancellationRate));

  const response =
    input.responseRate == null
      ? 0.65
      : Math.max(0, Math.min(1, input.responseRate));

  const completeness = Math.max(
    0,
    Math.min(1, input.profileCompleteness / 100),
  );

  let activity = 0.55;
  if (input.daysSinceActivity != null) {
    if (input.daysSinceActivity <= 7) activity = 1;
    else if (input.daysSinceActivity <= 30) activity = 0.85;
    else if (input.daysSinceActivity <= 90) activity = 0.6;
    else activity = 0.35;
  }

  const raw =
    verification * w.verification +
    jobs * w.jobs +
    reviewQuality * w.reviews +
    cancellation * w.cancellation +
    response * w.response +
    completeness * w.completeness +
    activity * w.activity;

  return Math.max(1, Math.min(99, Math.round(raw * 100)));
}
