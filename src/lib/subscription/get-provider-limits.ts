import { getCurrentSubscription, ensureFreeSubscription } from "@/lib/subscription/repository";
import { getLimitsForPlan } from "@/lib/subscription/limits";
import type { PlanFeatures } from "@/lib/subscription/types";

export async function getProviderPlanLimits(providerId: string): Promise<PlanFeatures> {
  await ensureFreeSubscription(providerId);
  const subscription = await getCurrentSubscription(providerId);
  const slug = subscription?.planSlug ?? "free";
  return getLimitsForPlan(slug, subscription?.features);
}
