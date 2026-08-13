/**
 * Provider subscription visibility — central gate for search, matching, featured.
 * When PROVIDER_MONETIZATION is off, all providers remain visible (legacy).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import type { ProviderMonetizationPlan } from "./types";

/** Days after period end before the provider is hidden from customers. */
export const SUBSCRIPTION_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = SUBSCRIPTION_GRACE_DAYS * DAY_MS;

/** Sentinel: included unlocks are unlimited under the flat $5/mo plan. */
export const INCLUDED_UNLOCKS_UNLIMITED = -1;

export type SubscriptionVisibilityPhase =
  | "active"
  | "grace"
  | "hidden"
  | "unpaid";

export type SubscriptionVisibility = {
  visible: boolean;
  phase: SubscriptionVisibilityPhase;
  /** Whole days remaining in the grace window (null when not in grace). */
  graceDaysRemaining: number | null;
  periodEnd: string | null;
};

function periodEndIso(plan: ProviderMonetizationPlan): string | null {
  return plan.currentPeriodEnd ?? plan.businessExpiresAt;
}

/**
 * Pure visibility check from a plan row.
 * Visible when billingMode is business and now is before periodEnd + 7d grace.
 */
export function getSubscriptionVisibility(
  plan: ProviderMonetizationPlan,
  nowMs = Date.now(),
): SubscriptionVisibility {
  if (!isProviderMonetizationEnabled()) {
    return {
      visible: true,
      phase: "active",
      graceDaysRemaining: null,
      periodEnd: periodEndIso(plan),
    };
  }

  const endIso = periodEndIso(plan);
  if (!endIso || plan.billingMode !== "business") {
    return {
      visible: false,
      phase: "unpaid",
      graceDaysRemaining: null,
      periodEnd: endIso,
    };
  }

  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(endMs)) {
    return {
      visible: false,
      phase: "unpaid",
      graceDaysRemaining: null,
      periodEnd: endIso,
    };
  }

  const graceEnd = endMs + GRACE_MS;

  if (nowMs <= endMs) {
    return {
      visible: true,
      phase: plan.status === "past_due" ? "grace" : "active",
      graceDaysRemaining:
        plan.status === "past_due"
          ? Math.max(1, Math.ceil((graceEnd - nowMs) / DAY_MS))
          : null,
      periodEnd: endIso,
    };
  }

  if (nowMs <= graceEnd) {
    return {
      visible: true,
      phase: "grace",
      graceDaysRemaining: Math.max(1, Math.ceil((graceEnd - nowMs) / DAY_MS)),
      periodEnd: endIso,
    };
  }

  return {
    visible: false,
    phase: "hidden",
    graceDaysRemaining: 0,
    periodEnd: endIso,
  };
}

export function isUnlimitedIncludedUnlocks(allowance: number): boolean {
  return allowance < 0 || allowance === INCLUDED_UNLOCKS_UNLIMITED;
}

/**
 * Returns the subset of provider IDs that may appear in customer surfaces.
 * When the monetization flag is off, returns all input ids unchanged.
 */
export async function filterVisibleProviderIds(
  providerIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(providerIds.filter(Boolean))];
  if (unique.length === 0) return new Set();

  if (!isProviderMonetizationEnabled()) {
    return new Set(unique);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data } = await db
    .from("provider_monetization_plans")
    .select(
      "provider_id, billing_mode, status, business_expires_at, current_period_end",
    )
    .in("provider_id", unique);

  const byId = new Map<string, ProviderMonetizationPlan>();
  for (const row of data ?? []) {
    byId.set(String(row.provider_id), {
      providerId: String(row.provider_id),
      billingMode: row.billing_mode === "business" ? "business" : "free",
      status: (row.status as ProviderMonetizationPlan["status"]) ?? "cancelled",
      businessExpiresAt: row.business_expires_at
        ? String(row.business_expires_at)
        : null,
      premiumBadge: false,
      searchBoost: false,
      analyticsEnabled: false,
      marketingEnabled: false,
      aiInsightsEnabled: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: row.current_period_end
        ? String(row.current_period_end)
        : null,
      currentPeriodStart: null,
    });
  }

  const visible = new Set<string>();
  for (const id of unique) {
    const plan = byId.get(id);
    if (!plan) continue; // no plan row → unpaid / not visible
    if (getSubscriptionVisibility(plan).visible) {
      visible.add(id);
    }
  }
  return visible;
}
