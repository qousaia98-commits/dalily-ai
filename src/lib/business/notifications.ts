import type { PlanSlug } from "@/lib/subscription/types";

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
  reviewCount: number;
  hasPendingReviewPayment: boolean;
  recentlyApprovedPayment: boolean;
}): GrowthNotification[] {
  const items: GrowthNotification[] = [];

  if (input.hasPendingReviewPayment) {
    items.push({ id: "payment_pending", tone: "gold", messageKey: "paymentPending" });
  }
  if (
    input.recentlyApprovedPayment ||
    (input.subscriptionStatus === "active" && input.planSlug !== "free")
  ) {
    if (input.planSlug === "pro" || input.planSlug === "premium") {
      items.push({
        id: "plan_active",
        tone: "success",
        messageKey: input.planSlug === "premium" ? "premiumActive" : "proActive",
      });
    }
  }
  if (input.verificationStatus === "verified") {
    items.push({ id: "verified", tone: "success", messageKey: "verificationApproved" });
  }
  if (input.searchAppearances > 0) {
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
