/**
 * Wallet service — balances + append-only ledger (server-side only).
 * Mutations go through SECURITY DEFINER RPC with row lock + idempotency.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { WalletBalances, WalletLedgerEntry } from "@/domains/payment/shared/types";
import { isPaymentWalletEnabled } from "@/lib/config/feature-flags";
import { logFinancialAudit } from "@/domains/payment/audit";

export { computeWalletBalancesAfterEntry } from "@/domains/payment/wallet/ledger-math";
export type {
  WalletBalanceSnapshot,
  LedgerEntryType,
} from "@/domains/payment/wallet/ledger-math";

function mapWallet(row: Record<string, unknown>): WalletBalances {
  return {
    walletId: row.id as string,
    userId: row.user_id as string,
    currency: (row.currency as string) || "SYP",
    available: Number(row.available_balance ?? 0),
    reserved: Number(row.reserved_balance ?? 0),
    pendingPayout: Number(row.pending_payout_balance ?? 0),
    refund: Number(row.refund_balance ?? 0),
    bonus: Number(row.bonus_balance ?? 0),
    status: (row.status as WalletBalances["status"]) ?? "active",
  };
}

function mapWalletFromRpc(w: Record<string, unknown>): WalletBalances {
  return {
    walletId: String(w.walletId),
    userId: String(w.userId),
    currency: String(w.currency ?? "SYP"),
    available: Number(w.available ?? 0),
    reserved: Number(w.reserved ?? 0),
    pendingPayout: Number(w.pendingPayout ?? 0),
    refund: Number(w.refund ?? 0),
    bonus: Number(w.bonus ?? 0),
    status: (w.status as WalletBalances["status"]) ?? "active",
  };
}

export async function getOrCreateWallet(input: {
  userId: string;
  currency?: string;
}): Promise<WalletBalances | null> {
  if (!isPaymentWalletEnabled()) return null;
  const currency = input.currency ?? "SYP";
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  const { data: existing } = await client
    .from("wallets")
    .select("*")
    .eq("user_id", input.userId)
    .eq("currency", currency)
    .maybeSingle();

  if (existing) return mapWallet(existing as Record<string, unknown>);

  const { data: created, error } = await client
    .from("wallets")
    .insert({
      user_id: input.userId,
      currency,
    })
    .select("*")
    .single();

  if (error?.code === "23505") {
    const { data: again } = await client
      .from("wallets")
      .select("*")
      .eq("user_id", input.userId)
      .eq("currency", currency)
      .maybeSingle();
    return again ? mapWallet(again as Record<string, unknown>) : null;
  }

  if (error || !created) return null;
  return mapWallet(created as Record<string, unknown>);
}

export async function listWalletLedger(input: {
  userId: string;
  limit?: number;
}): Promise<WalletLedgerEntry[]> {
  if (!isPaymentWalletEnabled()) return [];
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("wallet_ledger")
    .select("*")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    walletId: r.wallet_id as string,
    entryType: r.entry_type as string,
    amount: Number(r.amount),
    currency: (r.currency as string) || "SYP",
    balanceAfter: r.balance_after != null ? Number(r.balance_after) : null,
    paymentId: (r.payment_id as string | null) ?? null,
    escrowId: (r.escrow_id as string | null) ?? null,
    payoutId: (r.payout_id as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

type LedgerWrite = {
  userId: string;
  entryType:
    | "credit"
    | "debit"
    | "reserve"
    | "release"
    | "refund"
    | "payout"
    | "bonus"
    | "fee"
    | "adjustment";
  amount: number;
  currency?: string;
  paymentId?: string | null;
  escrowId?: string | null;
  payoutId?: string | null;
  idempotencyKey: string;
  description?: string;
  actorId?: string | null;
};

/**
 * Atomic wallet mutation via Supabase RPC (SELECT FOR UPDATE + ledger insert).
 * Idempotent on (wallet_id, idempotency_key).
 */
export async function applyWalletLedgerEntry(
  input: LedgerWrite,
): Promise<{ ok: true; wallet: WalletBalances } | { ok: false; error: string }> {
  if (!isPaymentWalletEnabled()) return { ok: false, error: "feature_disabled" };
  if (!(input.amount > 0) || !Number.isFinite(input.amount)) {
    return { ok: false, error: "invalid_amount" };
  }
  if (!input.idempotencyKey?.trim()) {
    return { ok: false, error: "idempotency_required" };
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  const before = await getOrCreateWallet({
    userId: input.userId,
    currency: input.currency,
  });

  const { data, error } = await client.rpc("apply_wallet_ledger_entry", {
    p_user_id: input.userId,
    p_entry_type: input.entryType,
    p_amount: input.amount,
    p_currency: input.currency ?? "SYP",
    p_idempotency_key: input.idempotencyKey,
    p_payment_id: input.paymentId ?? null,
    p_escrow_id: input.escrowId ?? null,
    p_payout_id: input.payoutId ?? null,
    p_description: input.description ?? null,
  });

  if (error) {
    await logFinancialAudit({
      actorId: input.actorId ?? input.userId,
      action: "wallet_ledger",
      objectType: "wallet",
      objectId: before?.walletId ?? input.userId,
      oldState: before
        ? { available: before.available, reserved: before.reserved }
        : null,
      result: "failure",
      metadata: { entryType: input.entryType, error: error.message },
    });
    return { ok: false, error: "ledger_failed" };
  }

  const payload = data as {
    ok?: boolean;
    error?: string;
    wallet?: Record<string, unknown>;
  } | null;

  if (!payload?.ok || !payload.wallet) {
    const err = payload?.error ?? "ledger_failed";
    await logFinancialAudit({
      actorId: input.actorId ?? input.userId,
      action: "wallet_ledger",
      objectType: "wallet",
      objectId: before?.walletId ?? input.userId,
      oldState: before
        ? { available: before.available, reserved: before.reserved }
        : null,
      result: "rejected",
      metadata: { entryType: input.entryType, error: err },
    });
    return { ok: false, error: err };
  }

  const wallet = mapWalletFromRpc(payload.wallet);
  await logFinancialAudit({
    actorId: input.actorId ?? input.userId,
    action: "wallet_ledger",
    objectType: "wallet",
    objectId: wallet.walletId,
    oldState: before
      ? { available: before.available, reserved: before.reserved }
      : null,
    newState: { available: wallet.available, reserved: wallet.reserved },
    result: "success",
    correlationId: input.idempotencyKey,
    metadata: { entryType: input.entryType, amount: input.amount },
  });

  return { ok: true, wallet };
}
