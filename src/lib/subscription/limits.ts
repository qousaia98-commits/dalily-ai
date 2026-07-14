import type { PlanFeatures, PlanSlug } from "@/lib/subscription/types";

export const SUBSCRIPTION_RANKING_BONUS_MAX = 0.05;

export const DEFAULT_FREE_LIMITS: PlanFeatures = {
  maxServices: 5,
  maxImages: 5,
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
    return { ...DEFAULT_FREE_LIMITS, maxServices: null, maxImages: 20, verifiedBadge: true, advancedAnalytics: true, aiProfileOptimization: true, priorityVerification: true, rankingBonus: 0.03 };
  }
  if (slug === "premium") {
    return { ...DEFAULT_FREE_LIMITS, maxServices: null, maxImages: 20, verifiedBadge: true, advancedAnalytics: true, aiProfileOptimization: true, priorityVerification: true, featuredSection: true, premiumBadge: true, profileVideo: true, customPage: true, prioritySupport: true, earlyAccess: true, rankingBonus: SUBSCRIPTION_RANKING_BONUS_MAX };
  }
  return DEFAULT_FREE_LIMITS;
}

export function rankingBonusForPlan(slug: PlanSlug, features?: PlanFeatures): number {
  const bonus = features?.rankingBonus ?? getLimitsForPlan(slug).rankingBonus;
  return Math.min(bonus, SUBSCRIPTION_RANKING_BONUS_MAX);
}
