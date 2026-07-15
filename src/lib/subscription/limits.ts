import type { PlanFeatures, PlanSlug } from "@/lib/subscription/types";

/** Soft ranking boost caps — tier order is enforced separately in rankProviders. */
export const SUBSCRIPTION_RANKING_BONUS_MAX = 0.08;

export const DEFAULT_FREE_LIMITS: PlanFeatures = {
  maxServices: null,
  maxImages: null,
  searchVisible: true,
  basicAnalytics: true,
  verifiedBadge: false,
  advancedAnalytics: false,
  aiProfileOptimization: false,
  priorityVerification: false,
  featuredSection: false,
  premiumBadge: false,
  profileVideo: false,
  customPage: false,
  prioritySupport: false,
  earlyAccess: false,
  rankingBonus: 0,
};

export function getLimitsForPlan(slug: PlanSlug, features?: PlanFeatures): PlanFeatures {
  if (features) return features;
  if (slug === "pro") {
    return {
      ...DEFAULT_FREE_LIMITS,
      verifiedBadge: true,
      advancedAnalytics: true,
      aiProfileOptimization: true,
      priorityVerification: true,
      prioritySupport: true,
      rankingBonus: 0.05,
    };
  }
  if (slug === "premium") {
    return {
      ...DEFAULT_FREE_LIMITS,
      verifiedBadge: true,
      advancedAnalytics: true,
      aiProfileOptimization: true,
      priorityVerification: true,
      featuredSection: true,
      premiumBadge: true,
      profileVideo: true,
      customPage: true,
      prioritySupport: true,
      earlyAccess: true,
      rankingBonus: SUBSCRIPTION_RANKING_BONUS_MAX,
    };
  }
  return DEFAULT_FREE_LIMITS;
}

export function rankingBonusForPlan(slug: PlanSlug, features?: PlanFeatures): number {
  const bonus = features?.rankingBonus ?? getLimitsForPlan(slug).rankingBonus;
  return Math.min(bonus, SUBSCRIPTION_RANKING_BONUS_MAX);
}

/** Premium > PRO > Starter — primary marketplace tier. */
export function planTierRank(slug: PlanSlug): number {
  if (slug === "premium") return 3;
  if (slug === "pro") return 2;
  return 1;
}
