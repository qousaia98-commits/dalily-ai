export type {
  BillingMode,
  MonetizationBillingSettings,
  ProviderMonetizationPlan,
  MonthlyUnlockUsage,
  LeadPricingFactors,
  LeadPricingResult,
  MonetizationDashboard,
} from "./types";

export { getBillingSettings, updateBillingSettings, writeMonetizationAudit } from "./settings";
export { calculateLeadUnlockPrice } from "./pricing";
export {
  ensureProviderMonetizationPlan,
  upgradeToBusinessPlan,
  ensureMonthlyUsage,
  consumeIncludedUnlock,
  resetMonthlyIncludedUnlocks,
  currentPeriodYm,
} from "./plans";
export { inferLeadPricingFactors, quoteAndPersistLeadPrice } from "./quote";
export { getMonetizationDashboard } from "./dashboard";
export {
  getSubscriptionVisibility,
  filterVisibleProviderIds,
  SUBSCRIPTION_GRACE_DAYS,
  INCLUDED_UNLOCKS_UNLIMITED,
  isUnlimitedIncludedUnlocks,
  type SubscriptionVisibility,
  type SubscriptionVisibilityPhase,
} from "./visibility";

export async function getProviderSubscriptionVisibility(providerId: string) {
  const { ensureProviderMonetizationPlan } = await import("./plans");
  const { getSubscriptionVisibility } = await import("./visibility");
  const plan = await ensureProviderMonetizationPlan(providerId);
  return getSubscriptionVisibility(plan);
}
