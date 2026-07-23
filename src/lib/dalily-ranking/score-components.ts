/**
 * Independent normalized (0–1) score components.
 * Each function is isolated so weights / ML can swap later.
 */

import type { ScoreCalculatorInput, DalilyComponentScores } from "@/lib/dalily-ranking/types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

export function scoreQuality(input: ScoreCalculatorInput): number {
  const rating = clamp01(input.ratingAvg / 5);
  const volume = clamp01(Math.log10(1 + input.reviewCount) / 2.2);
  const trust = clamp01(input.trustScore / 100);
  // Verified reviews proxy: trust + volume
  const verifiedReviews = clamp01(trust * 0.6 + volume * 0.4);
  return clamp01(rating * 0.4 + volume * 0.2 + trust * 0.2 + verifiedReviews * 0.2);
}

export function scoreTrust(input: ScoreCalculatorInput): number {
  let v = 0.25;
  switch (input.verificationStatus) {
    case "verified":
      v = 1;
      break;
    case "partially_verified":
      v = 0.75;
      break;
    case "pending":
      v = 0.5;
      break;
    default:
      v = 0.25;
  }
  const jobs = clamp01(Math.log10(1 + input.completedJobs) / 2.5);
  const cancelPenalty =
    input.cancellationRate != null ? clamp01(1 - input.cancellationRate) : 0.7;
  return clamp01(v * 0.55 + jobs * 0.25 + cancelPenalty * 0.2);
}

export function scoreReliability(input: ScoreCalculatorInput): number {
  const accept = input.acceptanceRate != null ? clamp01(input.acceptanceRate) : 0.55;
  const complete = input.completionRate != null ? clamp01(input.completionRate) : 0.55;
  const cancel =
    input.cancellationRate != null ? clamp01(1 - input.cancellationRate) : 0.65;
  // Late arrival / confirmation time approximated via response hours
  const confirm =
    input.responseTimeHours == null
      ? 0.5
      : clamp01(1 - input.responseTimeHours / 36);
  return clamp01(accept * 0.3 + complete * 0.35 + cancel * 0.2 + confirm * 0.15);
}

export function scoreActivity(input: ScoreCalculatorInput): number {
  const updatedDays = daysSince(input.updatedAt);
  const createdDays = daysSince(input.createdAt);
  const freshness =
    updatedDays == null ? 0.45 : clamp01(1 - updatedDays / 60);
  const tenureBoost =
    createdDays == null ? 0.4 : clamp01(Math.min(createdDays, 365) / 365);
  const recentJobs = clamp01(Math.log10(1 + input.completedJobs) / 2);
  return clamp01(freshness * 0.45 + tenureBoost * 0.2 + recentJobs * 0.35);
}

export function scoreAvailability(input: ScoreCalculatorInput): number {
  if (input.availabilityHint != null) return clamp01(input.availabilityHint);
  // Neutral until live schedule is wired into search context
  return 0.55;
}

export function scoreDistance(input: ScoreCalculatorInput): number {
  if (input.distanceKm == null || !Number.isFinite(input.distanceKm)) return 0.45;
  const scale = Math.max(5, input.radiusKm ?? 25);
  return clamp01(1 - input.distanceKm / scale);
}

export function scoreExperience(input: ScoreCalculatorInput): number {
  const yearsProxy = daysSince(input.createdAt);
  const years =
    yearsProxy == null ? 0.35 : clamp01(yearsProxy / (365 * 5));
  const jobs = clamp01(Math.log10(1 + input.completedJobs) / 2.5);
  const specialist = input.matchesCategory ? 0.85 : 0.45;
  return clamp01(years * 0.3 + jobs * 0.45 + specialist * 0.25);
}

export function scoreProfileQuality(input: ScoreCalculatorInput): number {
  return clamp01(input.profileCompleteness / 100);
}

export function scorePopularity(input: ScoreCalculatorInput): number {
  const views = clamp01(Math.log10(1 + (input.profileViews ?? 0)) / 3);
  const appearances = clamp01(Math.log10(1 + (input.searchAppearances ?? 0)) / 3);
  const conversion =
    input.bookingConversionRate != null
      ? clamp01(input.bookingConversionRate / 100)
      : clamp01(Math.log10(1 + input.reviewCount) / 2.5);
  const repeat =
    input.repeatCustomers != null
      ? clamp01(input.repeatCustomers / 10)
      : clamp01(input.completedJobs / 20);
  // Fallback when analytics not passed: review volume + jobs
  if (
    input.profileViews == null &&
    input.searchAppearances == null &&
    input.bookingConversionRate == null
  ) {
    return clamp01(
      clamp01(Math.log10(1 + input.reviewCount) / 2.2) * 0.55 +
        clamp01(Math.log10(1 + input.completedJobs) / 2.5) * 0.45,
    );
  }
  return clamp01(views * 0.3 + appearances * 0.25 + conversion * 0.25 + repeat * 0.2);
}

export function scoreResponse(input: ScoreCalculatorInput): number {
  const speed =
    input.responseTimeHours == null
      ? 0.45
      : clamp01(1 - input.responseTimeHours / 24);
  const unread =
    input.unreadRatio == null ? 0.55 : clamp01(1 - input.unreadRatio);
  const consistency = clamp01((speed + unread) / 2);
  return clamp01(speed * 0.5 + unread * 0.25 + consistency * 0.25);
}

export function computeAllComponents(input: ScoreCalculatorInput): DalilyComponentScores {
  return {
    quality: scoreQuality(input),
    trust: scoreTrust(input),
    reliability: scoreReliability(input),
    activity: scoreActivity(input),
    availability: scoreAvailability(input),
    distance: scoreDistance(input),
    experience: scoreExperience(input),
    profileQuality: scoreProfileQuality(input),
    popularity: scorePopularity(input),
    response: scoreResponse(input),
  };
}
