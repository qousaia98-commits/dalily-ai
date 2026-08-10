/**
 * Daily subscription reminders — expiry lead + grace window.
 * Invoked from /api/cron/subscription-reminders and daily-maintenance.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import { deliverMarketplaceNotification } from "@/lib/notifications/deliver";
import type { ProviderMonetizationPlan } from "./types";
import {
  getSubscriptionVisibility,
  SUBSCRIPTION_GRACE_DAYS,
} from "./visibility";

/** Days before period end to send the “renew soon” reminder. */
export const SUBSCRIPTION_REMINDER_LEAD_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function mapPlan(row: Record<string, unknown>): ProviderMonetizationPlan {
  return {
    providerId: String(row.provider_id),
    billingMode: row.billing_mode === "business" ? "business" : "free",
    status: (row.status as ProviderMonetizationPlan["status"]) ?? "cancelled",
    businessExpiresAt: row.business_expires_at
      ? String(row.business_expires_at)
      : null,
    premiumBadge: Boolean(row.premium_badge),
    searchBoost: Boolean(row.search_boost),
    analyticsEnabled: Boolean(row.analytics_enabled),
    marketingEnabled: Boolean(row.marketing_enabled),
    aiInsightsEnabled: Boolean(row.ai_insights_enabled),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodEnd: row.current_period_end
      ? String(row.current_period_end)
      : null,
    currentPeriodStart: row.current_period_start
      ? String(row.current_period_start)
      : null,
  };
}

async function alreadyNotifiedToday(
  userId: string,
  type: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from("marketplace_notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

export type SubscriptionReminderResult = {
  scanned: number;
  expiringSent: number;
  graceSent: number;
  skipped: boolean;
};

/**
 * Notify providers:
 * - ~3 days before period end (active paid window)
 * - while in the 7-day grace window after period end
 */
export async function processSubscriptionReminders(): Promise<SubscriptionReminderResult> {
  if (!isProviderMonetizationEnabled()) {
    return { scanned: 0, expiringSent: 0, graceSent: 0, skipped: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data: rows } = await db
    .from("provider_monetization_plans")
    .select(
      "provider_id, billing_mode, status, business_expires_at, current_period_end, current_period_start, premium_badge, search_boost, analytics_enabled, marketing_enabled, ai_insights_enabled, cancel_at_period_end",
    )
    .eq("billing_mode", "business")
    .limit(2000);

  const plans = (rows ?? []).map((r: Record<string, unknown>) => mapPlan(r));
  if (plans.length === 0) {
    return { scanned: 0, expiringSent: 0, graceSent: 0, skipped: false };
  }

  const providerIds = plans.map((p: ProviderMonetizationPlan) => p.providerId);
  const { data: providers } = await db
    .from("providers")
    .select("id, owner_id")
    .in("id", providerIds)
    .is("deleted_at", null);

  const ownerByProvider = new Map<string, string>();
  for (const p of providers ?? []) {
    if (p.owner_id) ownerByProvider.set(String(p.id), String(p.owner_id));
  }

  const now = Date.now();
  let expiringSent = 0;
  let graceSent = 0;

  for (const plan of plans) {
    const ownerId = ownerByProvider.get(plan.providerId);
    if (!ownerId) continue;

    const visibility = getSubscriptionVisibility(plan, now);
    const endIso = visibility.periodEnd;
    if (!endIso) continue;

    const endMs = new Date(endIso).getTime();
    if (!Number.isFinite(endMs)) continue;

    const msUntilEnd = endMs - now;

    // Active period ending in exactly LEAD_DAYS (ceil) so a daily cron hits once
    if (visibility.phase === "active" && msUntilEnd > 0) {
      const daysUntilEnd = Math.ceil(msUntilEnd / DAY_MS);
      if (daysUntilEnd === SUBSCRIPTION_REMINDER_LEAD_DAYS) {
        const type = "subscription_expiring";
        if (!(await alreadyNotifiedToday(ownerId, type))) {
          const result = await deliverMarketplaceNotification({
            userId: ownerId,
            type,
            titleKey: "notifications.subscriptionExpiring.title",
            bodyKey: "notifications.subscriptionExpiring.body",
            bodyParams: {
              days: SUBSCRIPTION_REMINDER_LEAD_DAYS,
              price: 5,
            },
            href: "/business/subscription",
          });
          if (result.ok) expiringSent += 1;
        }
      }
    }

    if (visibility.phase === "grace") {
      const type = "subscription_grace";
      if (!(await alreadyNotifiedToday(ownerId, type))) {
        const result = await deliverMarketplaceNotification({
          userId: ownerId,
          type,
          titleKey: "notifications.subscriptionGrace.title",
          bodyKey: "notifications.subscriptionGrace.body",
          bodyParams: {
            days: visibility.graceDaysRemaining ?? SUBSCRIPTION_GRACE_DAYS,
            graceDays: SUBSCRIPTION_GRACE_DAYS,
          },
          href: "/business/subscription",
        });
        if (result.ok) graceSent += 1;
      }
    }
  }

  return {
    scanned: plans.length,
    expiringSent,
    graceSent,
    skipped: false,
  };
}
