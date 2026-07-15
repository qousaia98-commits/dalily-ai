import type { ManagedProvider } from "@/types/provider.types";
import type { PlanSlug } from "@/lib/subscription/types";
import { calculateBusinessHealth } from "@/lib/business/health-score";

export type AchievementId =
  | "profile_completed"
  | "first_review"
  | "first_contact"
  | "verified"
  | "views_100"
  | "views_1000"
  | "premium_member";

export type Achievement = {
  id: AchievementId;
  unlocked: boolean;
};

export function computeAchievements(input: {
  provider: ManagedProvider;
  planSlug: PlanSlug;
  searchAppearances: number;
}): Achievement[] {
  const health = calculateBusinessHealth(input.provider);
  const hasContact = Boolean(input.provider.phone || input.provider.whatsapp);

  return [
    { id: "profile_completed", unlocked: health.score >= 90 },
    { id: "first_review", unlocked: input.provider.reviewCount > 0 },
    { id: "first_contact", unlocked: hasContact },
    {
      id: "verified",
      unlocked:
        input.provider.verificationStatus === "verified" ||
        input.provider.verificationStatus === "partially_verified",
    },
    { id: "views_100", unlocked: input.searchAppearances >= 100 },
    { id: "views_1000", unlocked: input.searchAppearances >= 1000 },
    { id: "premium_member", unlocked: input.planSlug === "premium" },
  ];
}
