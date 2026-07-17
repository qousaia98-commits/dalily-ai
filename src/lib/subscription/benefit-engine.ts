import { getLimitsForPlan, planTierRank } from "@/lib/subscription/limits";
import type { PlanFeatures, PlanSlug } from "@/lib/subscription/types";

/**
 * Central subscription benefit engine (client + server safe).
 * Pages must ask this module — never scatter `if (plan === "pro")` in UI.
 */
export type BenefitFlags = {
  canViewAnalytics: boolean;
  canViewGrowthDashboard: boolean;
  canViewProfileViews: boolean;
  canViewSearchPerformance: boolean;
  canUseProBadge: boolean;
  canUsePremiumBadge: boolean;
  canAppearFeatured: boolean;
  canAccessAdvancedInsights: boolean;
  canReceivePriorityRanking: boolean;
  canViewConversions: boolean;
  canViewVisitorCities: boolean;
  canViewPopularSearchTerms: boolean;
  canViewWeeklyGrowthReport: boolean;
  canViewPerformanceComparison: boolean;
  showPrioritySupportBadge: boolean;
  showPremiumDashboardTheme: boolean;
  showPremiumSearchAppearance: boolean;
};

export type PlanDisplay = {
  slug: PlanSlug;
  marketingId: "starter" | "pro" | "premium";
  label: "Starter" | "PRO" | "PREMIUM";
  icon: "none" | "star" | "crown";
};

export function resolvePlanDisplay(planSlug: PlanSlug | string): PlanDisplay {
  if (planSlug === "premium") {
    return { slug: "premium", marketingId: "premium", label: "PREMIUM", icon: "crown" };
  }
  if (planSlug === "pro") {
    return { slug: "pro", marketingId: "pro", label: "PRO", icon: "star" };
  }
  return { slug: "free", marketingId: "starter", label: "Starter", icon: "none" };
}

export function getBenefits(
  planSlug: PlanSlug,
  features?: PlanFeatures,
): BenefitFlags {
  const limits = getLimitsForPlan(planSlug, features);
  const isPro = planSlug === "pro" || planSlug === "premium";
  const isPremium = planSlug === "premium";

  return {
    canViewAnalytics: true,
    canViewGrowthDashboard: isPro,
    canViewProfileViews: isPro,
    canViewSearchPerformance: isPro,
    canUseProBadge: isPro,
    canUsePremiumBadge: isPremium || Boolean(limits.premiumBadge),
    canAppearFeatured: isPremium || Boolean(limits.featuredSection),
    canAccessAdvancedInsights: isPro || Boolean(limits.advancedAnalytics),
    canReceivePriorityRanking: planTierRank(planSlug) > 1,
    canViewConversions: isPro,
    canViewVisitorCities: isPremium,
    canViewPopularSearchTerms: isPremium,
    canViewWeeklyGrowthReport: isPremium,
    canViewPerformanceComparison: isPremium,
    showPrioritySupportBadge: isPremium,
    showPremiumDashboardTheme: isPremium,
    showPremiumSearchAppearance: isPremium,
  };
}
