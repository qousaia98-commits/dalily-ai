/**
 * Sprint 6 Phase 1 — provider monetization dashboard aggregate.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureMonthlyUsage,
  ensureProviderMonetizationPlan,
  currentPeriodYm,
} from "./plans";
import { getBillingSettings } from "./settings";
import type { MonetizationDashboard } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function getMonetizationDashboard(
  providerId: string,
): Promise<MonetizationDashboard> {
  const [plan, settings] = await Promise.all([
    ensureProviderMonetizationPlan(providerId),
    getBillingSettings(),
  ]);
  const usage = await ensureMonthlyUsage(
    providerId,
    plan.billingMode === "business" ? settings.includedUnlocks : 0,
  );

  // Flat model: only business plans have included leads (unlimited = -1).
  const effectiveUsage =
    plan.billingMode === "business"
      ? usage
      : {
          ...usage,
          includedAllowance: 0,
          remaining: 0,
        };

  const periodYm = currentPeriodYm();
  const monthStart = `${periodYm}-01T00:00:00.000Z`;

  let monthSpendUsd = 0;
  try {
    const { data: payments } = await db()
      .from("payments")
      .select("amount, currency, payment_status")
      .eq("provider_id", providerId)
      .eq("purpose", "unlock_fee")
      .in("payment_status", ["paid", "approved"])
      .gte("created_at", monthStart);
    for (const p of payments ?? []) {
      const cur = String(p.currency ?? "USD").toUpperCase();
      const amt = Number(p.amount ?? 0);
      // Prefer USD amounts; SYP legacy counted lightly as 0 for this dashboard
      if (cur === "USD") monthSpendUsd += amt;
    }
  } catch {
    monthSpendUsd = 0;
  }

  let unlockedCount = 0;
  try {
    const { count } = await db()
      .from("unlock_sessions")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .eq("status", "succeeded");
    unlockedCount = count ?? 0;
  } catch {
    unlockedCount = 0;
  }

  return {
    plan,
    usage: effectiveUsage,
    monthSpendUsd: Math.round(monthSpendUsd * 100) / 100,
    unlockedCount,
    settings: {
      businessPriceUsd: settings.businessPriceUsd,
      includedUnlocks: settings.includedUnlocks,
      minLeadPriceUsd: settings.minLeadPriceUsd,
      maxLeadPriceUsd: settings.maxLeadPriceUsd,
      currency: settings.currency,
    },
  };
}
