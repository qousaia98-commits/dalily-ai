import type { PlanSlug } from "@/lib/subscription/types";

export type MatchReasonId =
  | "verified"
  | "nearby"
  | "fastResponse"
  | "completedJobs"
  | "specialist"
  | "highRating"
  | "premium";

export type MatchReason = {
  id: MatchReasonId;
  /** Optional interpolation values for i18n */
  params?: Record<string, string | number>;
};

export function buildMatchReasons(input: {
  verified: boolean;
  distanceKm: number | null;
  responseTimeHours: number | null;
  completedJobs: number;
  categoryLabel?: string | null;
  rating: number;
  planSlug: PlanSlug;
  maxReasons?: number;
}): MatchReason[] {
  const reasons: MatchReason[] = [];
  const max = input.maxReasons ?? 5;

  if (input.verified) {
    reasons.push({ id: "verified" });
  }

  if (input.distanceKm != null && Number.isFinite(input.distanceKm)) {
    reasons.push({
      id: "nearby",
      params: { km: Math.round(input.distanceKm * 10) / 10 },
    });
  }

  if (input.responseTimeHours != null && input.responseTimeHours <= 1) {
    const minutes = Math.max(5, Math.round(input.responseTimeHours * 60));
    reasons.push({ id: "fastResponse", params: { minutes } });
  } else if (input.responseTimeHours != null && input.responseTimeHours <= 4) {
    reasons.push({
      id: "fastResponse",
      params: { minutes: Math.round(input.responseTimeHours * 60) },
    });
  }

  if (input.completedJobs >= 10) {
    reasons.push({ id: "completedJobs", params: { count: input.completedJobs } });
  }

  if (input.categoryLabel) {
    reasons.push({ id: "specialist", params: { category: input.categoryLabel } });
  }

  if (input.rating >= 4.5 && reasons.length < max) {
    reasons.push({ id: "highRating", params: { rating: input.rating } });
  }

  if (input.planSlug === "premium" && reasons.length < max) {
    reasons.push({ id: "premium" });
  }

  return reasons.slice(0, max);
}
