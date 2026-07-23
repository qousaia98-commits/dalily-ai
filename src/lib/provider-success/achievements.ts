import type { Achievement, ProviderLevel } from "@/lib/provider-success/types";

const LEVEL_THRESHOLDS = [0, 20, 40, 55, 70, 85, 95];

export function resolveProviderLevel(dalilyScore: number): ProviderLevel {
  const score = Math.max(0, Math.min(100, Math.round(dalilyScore)));
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (score >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const currentFloor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextLevelAt = LEVEL_THRESHOLDS[level] ?? 100;
  const span = Math.max(1, nextLevelAt - currentFloor);
  const progressPercent =
    level >= LEVEL_THRESHOLDS.length
      ? 100
      : Math.round(((score - currentFloor) / span) * 100);

  return {
    level,
    titleKey: `level${Math.min(level, 7)}`,
    currentScore: score,
    nextLevelAt: level >= LEVEL_THRESHOLDS.length ? 100 : nextLevelAt,
    progressPercent,
  };
}

export function resolveAchievements(input: {
  completedJobs: number;
  reviewCount: number;
  ratingAvg: number;
  verified: boolean;
  responseTimeHours: number | null;
  profileCompletion: number;
  totalBookings: number;
}): Achievement[] {
  const jobs = input.completedJobs;
  const defs: Array<{
    id: Achievement["id"];
    unlocked: boolean;
    progress: number;
  }> = [
    {
      id: "first_booking",
      unlocked: input.totalBookings >= 1,
      progress: Math.min(100, input.totalBookings * 100),
    },
    {
      id: "jobs_10",
      unlocked: jobs >= 10,
      progress: Math.min(100, Math.round((jobs / 10) * 100)),
    },
    {
      id: "jobs_50",
      unlocked: jobs >= 50,
      progress: Math.min(100, Math.round((jobs / 50) * 100)),
    },
    {
      id: "reviews_100",
      unlocked: input.reviewCount >= 100,
      progress: Math.min(100, Math.round((input.reviewCount / 100) * 100)),
    },
    {
      id: "verified",
      unlocked: input.verified,
      progress: input.verified ? 100 : 0,
    },
    {
      id: "fast_responder",
      unlocked:
        input.responseTimeHours != null && input.responseTimeHours > 0 && input.responseTimeHours <= 2,
      progress:
        input.responseTimeHours == null
          ? 0
          : Math.min(100, Math.round((2 / Math.max(input.responseTimeHours, 0.1)) * 100)),
    },
    {
      id: "top_rated",
      unlocked: input.ratingAvg >= 4.5 && input.reviewCount >= 5,
      progress: Math.min(
        100,
        Math.round((input.ratingAvg / 5) * 70 + Math.min(input.reviewCount, 5) * 6),
      ),
    },
    {
      id: "profile_complete",
      unlocked: input.profileCompletion >= 90,
      progress: input.profileCompletion,
    },
  ];

  return defs;
}

export function resolveBadges(input: {
  verified: boolean;
  ratingAvg: number;
  reviewCount: number;
  profileCompletion: number;
  completedJobs: number;
}): string[] {
  const badges: string[] = [];
  if (input.verified) badges.push("verified");
  if (input.ratingAvg >= 4.5 && input.reviewCount >= 5) badges.push("top_rated");
  if (input.profileCompletion >= 90) badges.push("profile_complete");
  if (input.completedJobs >= 10) badges.push("reliable");
  return badges;
}
