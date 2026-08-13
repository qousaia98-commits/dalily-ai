/**
 * Admin overview for enterprise payment platform (read-only aggregates).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isEscrowEngineEnabled,
  isPaymentWalletEnabled,
  isPayoutsEnabled,
  isPaymentsV2Enabled,
} from "@/lib/config/feature-flags";

export type EnterprisePaymentOverview = {
  walletsActive: number;
  walletsBalanceTotal: number;
  escrowReserved: number;
  escrowDisputed: number;
  payoutsPending: number;
  payoutsPaid: number;
  openDisputes: number;
  feeRulesEnabled: number;
};

export async function getEnterprisePaymentOverview(): Promise<EnterprisePaymentOverview> {
  const empty: EnterprisePaymentOverview = {
    walletsActive: 0,
    walletsBalanceTotal: 0,
    escrowReserved: 0,
    escrowDisputed: 0,
    payoutsPending: 0,
    payoutsPaid: 0,
    openDisputes: 0,
    feeRulesEnabled: 0,
  };
  if (!isPaymentsV2Enabled()) return empty;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  try {
    if (isPaymentWalletEnabled()) {
      const { data: wallets } = await client
        .from("wallets")
        .select("available_balance, status")
        .eq("status", "active")
        .limit(5000);
      const rows = (wallets ?? []) as Array<{ available_balance: number; status: string }>;
      empty.walletsActive = rows.length;
      empty.walletsBalanceTotal = rows.reduce(
        (s, w) => s + Number(w.available_balance ?? 0),
        0,
      );
    }

    if (isEscrowEngineEnabled()) {
      const { count: reserved } = await client
        .from("escrow_holds")
        .select("id", { count: "exact", head: true })
        .eq("status", "reserved");
      const { count: disputed } = await client
        .from("escrow_holds")
        .select("id", { count: "exact", head: true })
        .eq("status", "disputed");
      empty.escrowReserved = reserved ?? 0;
      empty.escrowDisputed = disputed ?? 0;

      const { count: openDisputes } = await client
        .from("marketplace_payment_disputes")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "investigating"]);
      empty.openDisputes = openDisputes ?? 0;
    }

    if (isPayoutsEnabled()) {
      const { count: pending } = await client
        .from("payouts")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "scheduled", "processing", "retrying"]);
      const { count: paid } = await client
        .from("payouts")
        .select("id", { count: "exact", head: true })
        .eq("status", "paid");
      empty.payoutsPending = pending ?? 0;
      empty.payoutsPaid = paid ?? 0;
    }

    const { count: feeRules } = await client
      .from("payment_fee_rules")
      .select("id", { count: "exact", head: true })
      .eq("enabled", true);
    empty.feeRulesEnabled = feeRules ?? 0;
  } catch {
    // tables may not exist yet before migration
  }

  return empty;
}

export async function listAdminEscrows(limit = 100) {
  if (!isEscrowEngineEnabled()) return [];
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("escrow_holds")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listAdminPayouts(limit = 100) {
  if (!isPayoutsEnabled()) return [];
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listAdminFeeRules() {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("payment_fee_rules")
    .select("*")
    .order("priority", { ascending: true });
  return data ?? [];
}

export async function listAdminMarketplaceDisputes(limit = 100) {
  if (!isEscrowEngineEnabled()) return [];
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("marketplace_payment_disputes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
