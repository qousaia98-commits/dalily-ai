/**
 * Fee engine — configurable rules from payment_fee_rules (defaults in code).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { FeeBreakdown } from "@/domains/payment/shared/types";

export type FeeRule = {
  code: string;
  feeType: string;
  calculation: string;
  percentBps: number;
  fixedAmount: number;
  enabled: boolean;
};

const DEFAULT_RULES: FeeRule[] = [
  {
    code: "platform_default",
    feeType: "platform",
    calculation: "percent",
    percentBps: 1000,
    fixedAmount: 0,
    enabled: true,
  },
];

export function getDefaultFeeRules(): FeeRule[] {
  return DEFAULT_RULES.map((r) => ({ ...r }));
}

async function loadRules(): Promise<FeeRule[]> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("payment_fee_rules")
      .select("code, fee_type, calculation, percent_bps, fixed_amount, enabled")
      .eq("enabled", true)
      .order("priority", { ascending: true });
    if (!data?.length) return DEFAULT_RULES;
    return (data as Array<Record<string, unknown>>).map((r) => ({
      code: String(r.code),
      feeType: String(r.fee_type),
      calculation: String(r.calculation),
      percentBps: Number(r.percent_bps ?? 0),
      fixedAmount: Number(r.fixed_amount ?? 0),
      enabled: Boolean(r.enabled),
    }));
  } catch {
    return DEFAULT_RULES;
  }
}

/** Pure fee amount for a single rule (before cent rounding). */
export function applyFeeRule(amount: number, rule: FeeRule): number {
  const pct = (amount * rule.percentBps) / 10_000;
  if (rule.calculation === "fixed") return rule.fixedAmount;
  if (rule.calculation === "hybrid") return pct + rule.fixedAmount;
  return pct;
}

/**
 * Pure fee breakdown from an explicit rule set (no DB).
 * Rounding: each fee component rounded to 2 decimals; totals likewise.
 */
export function calculateFeeBreakdownFromRules(
  input: {
    amount: number;
    currency?: string;
    discountAmount?: number;
  },
  rules: FeeRule[],
): FeeBreakdown {
  const currency = input.currency ?? "SYP";
  const discount = Math.max(0, input.discountAmount ?? 0);
  const gross = Math.max(0, input.amount - discount);

  let platformFee = 0;
  let providerFee = 0;
  let customerFee = 0;
  let tax = 0;
  const applied: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const fee = Math.round(applyFeeRule(gross, rule) * 100) / 100;
    applied.push(rule.code);
    switch (rule.feeType) {
      case "platform":
        platformFee += fee;
        break;
      case "provider":
        providerFee += fee;
        break;
      case "customer":
        customerFee += fee;
        break;
      case "tax":
        tax += fee;
        break;
      case "promotion":
        platformFee = Math.max(0, platformFee - fee);
        break;
      default:
        break;
    }
  }

  const netToProvider = Math.max(0, gross - platformFee - providerFee);
  const totalCharged = Math.round((gross + customerFee + tax) * 100) / 100;

  return {
    platformFee: Math.round(platformFee * 100) / 100,
    providerFee: Math.round(providerFee * 100) / 100,
    customerFee: Math.round(customerFee * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    discount,
    netToProvider: Math.round(netToProvider * 100) / 100,
    totalCharged,
    currency,
    appliedRuleCodes: applied,
  };
}

export async function calculateFeeBreakdown(input: {
  amount: number;
  currency?: string;
  discountAmount?: number;
}): Promise<FeeBreakdown> {
  const rules = await loadRules();
  return calculateFeeBreakdownFromRules(input, rules);
}
