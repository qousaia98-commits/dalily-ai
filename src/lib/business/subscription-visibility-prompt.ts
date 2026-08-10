/**
 * Soft “subscribe to be visible” dashboard nudge — mirrors onboarding card
 * dismiss/cooldown, independent copy (not day-tiered like OnboardingReminderCopyId).
 */

import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import { isCooldownActive } from "@/lib/business/onboarding-preference";
import {
  ensureProviderMonetizationPlan,
  getBillingSettings,
  getSubscriptionVisibility,
} from "@/lib/monetization";

export type SubscriptionVisibilityPrompt = {
  /** True when monetization is on and the provider is not currently visible. */
  show: boolean;
  priceUsd: number;
};

/**
 * Server helper: whether to show the onboarding-success / dashboard subscribe nudge.
 * Visible phases (active/grace) → show false. Unpaid/hidden → show true.
 */
export async function getSubscriptionVisibilityPrompt(
  providerId: string,
  options?: { cardDismissedAt?: number | null },
): Promise<SubscriptionVisibilityPrompt> {
  if (!isProviderMonetizationEnabled()) {
    return { show: false, priceUsd: 0 };
  }

  const [plan, settings] = await Promise.all([
    ensureProviderMonetizationPlan(providerId),
    getBillingSettings(),
  ]);
  const visibility = getSubscriptionVisibility(plan);
  const needsSubscribe =
    visibility.phase === "unpaid" || visibility.phase === "hidden";

  if (!needsSubscribe) {
    return { show: false, priceUsd: settings.businessPriceUsd };
  }

  if (isCooldownActive(options?.cardDismissedAt ?? null)) {
    return { show: false, priceUsd: settings.businessPriceUsd };
  }

  return { show: true, priceUsd: settings.businessPriceUsd };
}
