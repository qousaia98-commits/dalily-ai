import type { PlanSlug } from "@/lib/subscription/types";
import { getBenefits } from "@/lib/subscription/benefit-engine";

export type GrowthNotification = {
  id: string;
  tone: "info" | "success" | "gold";
  messageKey: string;
  messageParams?: Record<string, string | number>;
};

export function buildGrowthNotifications(input: {
  healthScore: number;
  searchAppearances: number;
  planSlug: PlanSlug;
  subscriptionStatus: string;
  verificationStatus: string;
  providerStatus?: string;
  reviewCount: number;
  hasPendingReviewPayment: boolean;
  recentlyApprovedPayment: boolean;
  changesRequested?: boolean;
}): GrowthNotification[] {
  const items: GrowthNotification[] = [];
  const benefits = getBenefits(input.planSlug);

  if (input.changesRequested || input.providerStatus === "changes_requested") {
    items.push({ id: "changes_requested", tone: "gold", messageKey: "changesRequested" });
  }
  if (input.hasPendingReviewPayment) {
    items.push({ id: "payment_pending", tone: "gold", messageKey: "paymentPending" });
  }
  // Temporary only — never permanent "PRO/PREMIUM activated" while plan stays active.
  if (input.recentlyApprovedPayment && benefits.canUseProBadge) {
    items.push({
      id: "plan_active",
      tone: "success",
      messageKey: benefits.canUsePremiumBadge ? "premiumActive" : "proActive",
    });
  }
  if (input.verificationStatus === "verified") {
    items.push({ id: "verified", tone: "success", messageKey: "verificationApproved" });
  }
  if (benefits.canViewProfileViews && input.searchAppearances > 0) {
    items.push({
      id: "views",
      tone: "info",
      messageKey: "profileViews",
      messageParams: { count: input.searchAppearances },
    });
  }
  if (input.reviewCount > 0) {
    items.push({ id: "review", tone: "success", messageKey: "firstReview" });
  }
  if (input.healthScore >= 90) {
    items.push({
      id: "health",
      tone: "gold",
      messageKey: "healthHigh",
      messageParams: { score: input.healthScore },
    });
  }

  return items.slice(0, 6);
}
