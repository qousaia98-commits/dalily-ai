/**
 * Sprint 6 Phase 1 — FREE / BUSINESS plan + monthly included unlocks.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingSettings, writeMonetizationAudit } from "./settings";
import type {
  BillingMode,
  MonthlyUnlockUsage,
  ProviderMonetizationPlan,
} from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export function currentPeriodYm(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodBounds(periodYm: string): { start: Date; end: Date } {
  const [y, m] = periodYm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function mapPlan(row: Record<string, unknown>): ProviderMonetizationPlan {
  return {
    providerId: String(row.provider_id),
    billingMode: row.billing_mode as BillingMode,
    status: row.status as ProviderMonetizationPlan["status"],
    businessExpiresAt: row.business_expires_at
      ? String(row.business_expires_at)
      : null,
    premiumBadge: Boolean(row.premium_badge),
    searchBoost: Boolean(row.search_boost),
    analyticsEnabled: Boolean(row.analytics_enabled),
    marketingEnabled: Boolean(row.marketing_enabled),
    aiInsightsEnabled: Boolean(row.ai_insights_enabled),
    stripeCustomerId: row.stripe_customer_id
      ? String(row.stripe_customer_id)
      : null,
    stripeSubscriptionId: row.stripe_subscription_id
      ? String(row.stripe_subscription_id)
      : null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodEnd: row.current_period_end
      ? String(row.current_period_end)
      : null,
    currentPeriodStart: row.current_period_start
      ? String(row.current_period_start)
      : null,
  };
}

export async function ensureProviderMonetizationPlan(
  providerId: string,
): Promise<ProviderMonetizationPlan> {
  try {
    const { data } = await db()
      .from("provider_monetization_plans")
      .select("*")
      .eq("provider_id", providerId)
      .maybeSingle();
    if (data) {
      // Expire business → fall back to free
      if (
        data.billing_mode === "business" &&
        data.business_expires_at &&
        new Date(String(data.business_expires_at)).getTime() < Date.now()
      ) {
        await db()
          .from("provider_monetization_plans")
          .update({
            billing_mode: "free",
            status: "cancelled",
            premium_badge: false,
            search_boost: false,
            analytics_enabled: false,
            marketing_enabled: false,
            ai_insights_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("provider_id", providerId);
        return {
          providerId,
          billingMode: "free",
          status: "cancelled",
          businessExpiresAt: String(data.business_expires_at),
          premiumBadge: false,
          searchBoost: false,
          analyticsEnabled: false,
          marketingEnabled: false,
          aiInsightsEnabled: false,
          stripeCustomerId: data.stripe_customer_id
            ? String(data.stripe_customer_id)
            : null,
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          currentPeriodStart: null,
        };
      }
      return mapPlan(data);
    }

    const { data: created } = await db()
      .from("provider_monetization_plans")
      .insert({
        provider_id: providerId,
        billing_mode: "free",
        status: "active",
      })
      .select("*")
      .single();
    if (created) return mapPlan(created);
  } catch {
    // fall through
  }
  return {
    providerId,
    billingMode: "free",
    status: "active",
    businessExpiresAt: null,
    premiumBadge: false,
    searchBoost: false,
    analyticsEnabled: false,
    marketingEnabled: false,
    aiInsightsEnabled: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    currentPeriodStart: null,
  };
}

export async function upgradeToBusinessPlan(input: {
  providerId: string;
  actorUserId?: string | null;
  months?: number;
}): Promise<ProviderMonetizationPlan> {
  const settings = await getBillingSettings();
  const months = input.months ?? 1;
  const now = new Date();
  const expires = new Date(now);
  expires.setUTCMonth(expires.getUTCMonth() + months);
  const periodYm = currentPeriodYm(now);
  const { start, end } = periodBounds(periodYm);

  await db().from("provider_monetization_plans").upsert(
    {
      provider_id: input.providerId,
      billing_mode: "business",
      status: "active",
      business_started_at: now.toISOString(),
      business_expires_at: expires.toISOString(),
      billing_period_start: start.toISOString().slice(0, 10),
      billing_period_end: end.toISOString().slice(0, 10),
      premium_badge: true,
      search_boost: true,
      analytics_enabled: true,
      marketing_enabled: true,
      ai_insights_enabled: true,
      updated_at: now.toISOString(),
    },
    { onConflict: "provider_id" },
  );

  // Ensure current month usage row with full allowance
  await ensureMonthlyUsage(input.providerId, settings.includedUnlocks);

  await writeMonetizationAudit({
    eventKey: "business_plan_upgraded",
    actorUserId: input.actorUserId,
    providerId: input.providerId,
    payload: {
      priceUsd: settings.businessPriceUsd,
      includedUnlocks: settings.includedUnlocks,
      expiresAt: expires.toISOString(),
    },
  });

  return ensureProviderMonetizationPlan(input.providerId);
}

export async function ensureMonthlyUsage(
  providerId: string,
  allowanceOverride?: number,
): Promise<MonthlyUnlockUsage> {
  const settings = await getBillingSettings();
  const periodYm = currentPeriodYm();
  const allowance = allowanceOverride ?? settings.includedUnlocks;
  const { end } = periodBounds(periodYm);

  try {
    const { data } = await db()
      .from("provider_monthly_unlock_usage")
      .select("*")
      .eq("provider_id", providerId)
      .eq("period_ym", periodYm)
      .maybeSingle();

    if (data) {
      const used = Number(data.used_count ?? 0);
      const included = Number(data.included_allowance ?? allowance);
      return {
        providerId,
        periodYm,
        includedAllowance: included,
        usedCount: used,
        remaining: Math.max(0, included - used),
        resetAt: data.reset_at ? String(data.reset_at) : end.toISOString(),
      };
    }

    const { data: created } = await db()
      .from("provider_monthly_unlock_usage")
      .insert({
        provider_id: providerId,
        period_ym: periodYm,
        included_allowance: allowance,
        used_count: 0,
        reset_at: end.toISOString(),
      })
      .select("*")
      .single();

    if (created) {
      return {
        providerId,
        periodYm,
        includedAllowance: Number(created.included_allowance),
        usedCount: 0,
        remaining: Number(created.included_allowance),
        resetAt: String(created.reset_at),
      };
    }
  } catch {
    // soft
  }

  return {
    providerId,
    periodYm,
    includedAllowance: allowance,
    usedCount: 0,
    remaining: allowance,
    resetAt: end.toISOString(),
  };
}

/**
 * Consume one included unlock. Returns false if none remaining or not business.
 */
export async function consumeIncludedUnlock(input: {
  providerId: string;
  unlockSessionId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  const plan = await ensureProviderMonetizationPlan(input.providerId);
  if (plan.billingMode !== "business" || plan.status !== "active") {
    return { ok: false, error: "not_business" };
  }

  const usage = await ensureMonthlyUsage(input.providerId);
  if (usage.remaining <= 0) {
    return { ok: false, error: "no_included_unlocks" };
  }

  const nextUsed = usage.usedCount + 1;
  const { error } = await db()
    .from("provider_monthly_unlock_usage")
    .update({
      used_count: nextUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("provider_id", input.providerId)
    .eq("period_ym", usage.periodYm)
    .eq("used_count", usage.usedCount); // optimistic lock

  if (error) return { ok: false, error: "consume_failed" };

  await writeMonetizationAudit({
    eventKey: "included_unlock_consumed",
    actorUserId: input.actorUserId,
    providerId: input.providerId,
    payload: {
      unlockSessionId: input.unlockSessionId,
      used: nextUsed,
      remaining: usage.includedAllowance - nextUsed,
      periodYm: usage.periodYm,
    },
  });

  return {
    ok: true,
    remaining: Math.max(0, usage.includedAllowance - nextUsed),
  };
}

/**
 * Reset all business providers' included unlocks for a new period.
 * Unused unlocks do NOT carry over (new row with used_count=0).
 */
export async function resetMonthlyIncludedUnlocks(periodYm?: string): Promise<{
  resetCount: number;
  periodYm: string;
}> {
  const settings = await getBillingSettings();
  const ym = periodYm ?? currentPeriodYm();
  const { end } = periodBounds(ym);

  const { data: businessProviders } = await db()
    .from("provider_monetization_plans")
    .select("provider_id")
    .eq("billing_mode", "business")
    .eq("status", "active");

  let resetCount = 0;
  for (const row of businessProviders ?? []) {
    const providerId = String(row.provider_id);
    await db().from("provider_monthly_unlock_usage").upsert(
      {
        provider_id: providerId,
        period_ym: ym,
        included_allowance: settings.includedUnlocks,
        used_count: 0,
        reset_at: end.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_id,period_ym" },
    );
    await writeMonetizationAudit({
      eventKey: "included_unlocks_reset",
      providerId,
      payload: {
        periodYm: ym,
        allowance: settings.includedUnlocks,
        carryOver: false,
      },
    });
    resetCount += 1;
  }

  return { resetCount, periodYm: ym };
}
