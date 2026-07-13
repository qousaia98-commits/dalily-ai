import type { VerificationStatus } from "@/types/database.types";
import type { Database } from "@/types/database.types";
import type { ProblemPriority } from "@/lib/search/engine/types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

export const DALILY_SCORE_WEIGHTS = {
  verification: 0.28,
  trustScore: 0.22,
  rating: 0.18,
  profileCompleteness: 0.17,
  recency: 0.1,
  urgencyAlignment: 0.05,
} as const;

export type DalilyScoreContext = {
  priority?: ProblemPriority | null;
};

function verificationScore(status: VerificationStatus): number {
  switch (status) {
    case "verified":
      return 1;
    case "partially_verified":
      return 0.75;
    case "pending":
      return 0.5;
    case "unverified":
      return 0.25;
    default:
      return 0;
  }
}

function normalizeTrustScore(trustScore: number): number {
  return Math.min(1, Math.max(0, trustScore / 100));
}

function normalizeRating(ratingAvg: number): number {
  return Math.min(1, Math.max(0, Number(ratingAvg) / 5));
}

function normalizeProfileCompleteness(value: number): number {
  return Math.min(1, Math.max(0, value / 100));
}

function recencyScore(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - ageDays / 365);
}

function urgencyAlignmentScore(
  provider: ProviderRow,
  priority: ProblemPriority | null | undefined,
): number {
  if (!priority || priority === "normal" || priority === "low") return 0.5;

  const verifiedBoost =
    provider.verification_status === "verified"
      ? 1
      : provider.verification_status === "partially_verified"
        ? 0.7
        : 0.3;

  const responseHours = provider.response_time_hours;
  const responseBoost =
    responseHours == null ? 0.5 : Math.max(0, 1 - responseHours / 48);

  return (verifiedBoost + responseBoost) / 2;
}

/**
 * Weighted Dalily Score — replaces sequential multi-field sorting.
 * All signals are normalized to 0–1 and combined with configurable weights.
 */
export function calculateDalilyScore(
  provider: ProviderRow,
  context: DalilyScoreContext = {},
): number {
  const weights = DALILY_SCORE_WEIGHTS;
  const urgencyWeight =
    context.priority && (context.priority === "emergency" || context.priority === "high")
      ? weights.urgencyAlignment
      : 0;

  const redistributed = urgencyWeight === 0 ? 1 : 1 - weights.urgencyAlignment;
  const scale = urgencyWeight === 0 ? 1 : redistributed / (1 - weights.urgencyAlignment);

  return (
    weights.verification * scale * verificationScore(provider.verification_status) +
    weights.trustScore * scale * normalizeTrustScore(provider.trust_score) +
    weights.rating * scale * normalizeRating(Number(provider.rating_avg)) +
    weights.profileCompleteness * scale * normalizeProfileCompleteness(provider.profile_completeness) +
    weights.recency * scale * recencyScore(provider.created_at) +
    urgencyWeight * urgencyAlignmentScore(provider, context.priority)
  );
}
