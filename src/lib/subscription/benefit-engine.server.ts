import {
  getBenefits,
  resolvePlanDisplay,
  type BenefitFlags,
  type PlanDisplay,
} from "@/lib/subscription/benefit-engine";
import {
  ensureFreeSubscription,
  getCurrentSubscription,
} from "@/lib/subscription/repository";
import type { PlanSlug } from "@/lib/subscription/types";

/** Server-only: resolve benefits for a provider from the database. */
export async function getProviderBenefits(providerId: string): Promise<{
  planSlug: PlanSlug;
  benefits: BenefitFlags;
  display: PlanDisplay;
}> {
  await ensureFreeSubscription(providerId);
  const subscription = await getCurrentSubscription(providerId);
  const planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
  return {
    planSlug,
    benefits: getBenefits(planSlug, subscription?.features),
    display: resolvePlanDisplay(planSlug),
  };
}
