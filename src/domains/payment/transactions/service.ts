/**
 * Transaction facade — unified payment + escrow + ledger history for APIs.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isPaymentsV2Enabled } from "@/lib/config/feature-flags";
import { getPaymentById } from "@/lib/payment/orchestration";
import { listEscrows } from "@/domains/payment/escrow/engine";
import { listWalletLedger } from "@/domains/payment/wallet/service";
import type { PaymentLifecycleStatus } from "@/lib/payment/canonical-types";

export type TransactionHistoryItem = {
  id: string;
  kind: "payment" | "escrow" | "ledger" | "payout";
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  reference?: string | null;
  description?: string | null;
};

export async function getPaymentStatus(paymentId: string) {
  if (!isPaymentsV2Enabled()) return null;
  return getPaymentById(paymentId);
}

export async function listUserPaymentHistory(input: {
  userId: string;
  providerId?: string | null;
  limit?: number;
}): Promise<TransactionHistoryItem[]> {
  if (!isPaymentsV2Enabled()) return [];
  const limit = input.limit ?? 40;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  const items: TransactionHistoryItem[] = [];

  // Payments where user is the provider owner (via providerId) or metadata customer
  if (input.providerId) {
    const { data: payments } = await client
      .from("payments")
      .select("id, payment_status, amount, currency, created_at, payment_reference, purpose")
      .eq("provider_id", input.providerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    for (const p of (payments ?? []) as Array<Record<string, unknown>>) {
      items.push({
        id: String(p.id),
        kind: "payment",
        status: String(p.payment_status),
        amount: Number(p.amount),
        currency: String(p.currency ?? "SYP"),
        createdAt: String(p.created_at),
        reference: p.payment_reference ? String(p.payment_reference) : null,
        description: p.purpose ? String(p.purpose) : null,
      });
    }
  }

  const escrows = await listEscrows({
    customerId: input.userId,
    limit,
  });
  for (const e of escrows) {
    items.push({
      id: e.id,
      kind: "escrow",
      status: e.status,
      amount: e.amount,
      currency: e.currency,
      createdAt: e.createdAt,
      description: "escrow",
    });
  }

  const ledger = await listWalletLedger({ userId: input.userId, limit });
  for (const l of ledger) {
    items.push({
      id: l.id,
      kind: "ledger",
      status: l.entryType,
      amount: l.amount,
      currency: l.currency,
      createdAt: l.createdAt,
      description: l.description,
    });
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items.slice(0, limit);
}

export const TRANSACTION_STATES: PaymentLifecycleStatus[] = [
  "pending",
  "authorized",
  "captured",
  "reserved",
  "released",
  "refunded",
  "cancelled",
  "failed",
  "expired",
  "disputed",
];
