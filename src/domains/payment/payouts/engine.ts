/**
 * Payout engine — scheduled / immediate provider payouts via adapters.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isPayoutsEnabled } from "@/lib/config/feature-flags";
import { applyWalletLedgerEntry } from "@/domains/payment/wallet/service";
import type { PayoutMethod, PayoutView } from "@/domains/payment/shared/types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapPayout(row: Record<string, unknown>): PayoutView {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    amount: Number(row.amount),
    currency: String(row.currency ?? "SYP"),
    method: row.method as PayoutMethod,
    status: String(row.status),
    escrowId: row.escrow_id ? String(row.escrow_id) : null,
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
    processedAt: row.processed_at ? String(row.processed_at) : null,
    createdAt: String(row.created_at),
  };
}

export async function getPayoutById(id: string): Promise<PayoutView | null> {
  if (!isPayoutsEnabled()) return null;
  const { data } = await db().from("payouts").select("*").eq("id", id).maybeSingle();
  return data ? mapPayout(data) : null;
}

export async function listPayouts(input: {
  providerId?: string;
  ownerUserId?: string;
  status?: string;
  limit?: number;
}): Promise<PayoutView[]> {
  if (!isPayoutsEnabled()) return [];
  let q = db()
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);
  if (input.providerId) q = q.eq("provider_id", input.providerId);
  if (input.ownerUserId) q = q.eq("owner_user_id", input.ownerUserId);
  if (input.status) q = q.eq("status", input.status);
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapPayout);
}

export async function createPayout(input: {
  providerId: string;
  ownerUserId: string;
  amount: number;
  currency?: string;
  method?: PayoutMethod;
  escrowId?: string | null;
  paymentId?: string | null;
  destinationRef?: string | null;
  idempotencyKey: string;
  scheduledAt?: string | null;
  processImmediately?: boolean;
}): Promise<{ ok: true; payout: PayoutView } | { ok: false; error: string }> {
  if (!isPayoutsEnabled()) return { ok: false, error: "feature_disabled" };
  if (!(input.amount > 0)) return { ok: false, error: "invalid_amount" };

  const { data: existing } = await db()
    .from("payouts")
    .select("*")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) return { ok: true, payout: mapPayout(existing) };

  const method = input.method ?? "wallet";
  const status = input.scheduledAt && !input.processImmediately ? "scheduled" : "pending";

  const { data, error } = await db()
    .from("payouts")
    .insert({
      provider_id: input.providerId,
      owner_user_id: input.ownerUserId,
      amount: input.amount,
      currency: input.currency ?? "SYP",
      method,
      status,
      escrow_id: input.escrowId ?? null,
      payment_id: input.paymentId ?? null,
      destination_ref: input.destinationRef ?? null,
      scheduled_at: input.scheduledAt ?? null,
      idempotency_key: input.idempotencyKey,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "create_failed" };
  }

  if (input.processImmediately || !input.scheduledAt) {
    return processPayout({ payoutId: String(data.id) });
  }

  return { ok: true, payout: mapPayout(data) };
}

/**
 * Process a pending/scheduled/retrying payout through the method adapter.
 * Wallet: credit provider owner wallet. Bank/manual/stripe: mark paid (ops rail).
 */
export async function processPayout(input: {
  payoutId: string;
}): Promise<{ ok: true; payout: PayoutView } | { ok: false; error: string }> {
  if (!isPayoutsEnabled()) return { ok: false, error: "feature_disabled" };

  const { data: row } = await db()
    .from("payouts")
    .select("*")
    .eq("id", input.payoutId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (row.status === "paid") return { ok: true, payout: mapPayout(row) };
  if (!["pending", "scheduled", "retrying", "failed"].includes(String(row.status))) {
    return { ok: false, error: "invalid_status" };
  }

  await db()
    .from("payouts")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", input.payoutId);

  const method = String(row.method) as PayoutMethod;
  const amount = Number(row.amount);
  const currency = String(row.currency ?? "SYP");
  const ownerUserId = String(row.owner_user_id);

  try {
    if (method === "wallet") {
      const credited = await applyWalletLedgerEntry({
        userId: ownerUserId,
        entryType: "credit",
        amount,
        currency,
        payoutId: input.payoutId,
        escrowId: row.escrow_id ? String(row.escrow_id) : null,
        paymentId: row.payment_id ? String(row.payment_id) : null,
        idempotencyKey: `payout-credit:${input.payoutId}`,
        description: "Provider payout",
      });
      if (!credited.ok) {
        await db()
          .from("payouts")
          .update({
            status: "failed",
            failure_reason: credited.error,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.payoutId);
        return { ok: false, error: credited.error };
      }
    }
    // bank / stripe / manual: recorded as paid for ops follow-up (adapter stubs)

    const now = new Date().toISOString();
    const { data: updated, error } = await db()
      .from("payouts")
      .update({
        status: "paid",
        processed_at: now,
        failure_reason: null,
        updated_at: now,
      })
      .eq("id", input.payoutId)
      .select("*")
      .single();

    if (error || !updated) return { ok: false, error: error?.message ?? "update_failed" };
    return { ok: true, payout: mapPayout(updated) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "process_failed";
    await db()
      .from("payouts")
      .update({
        status: "failed",
        failure_reason: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.payoutId);
    return { ok: false, error: msg };
  }
}

export async function retryPayout(input: {
  payoutId: string;
}): Promise<{ ok: true; payout: PayoutView } | { ok: false; error: string }> {
  if (!isPayoutsEnabled()) return { ok: false, error: "feature_disabled" };
  const { data: row } = await db()
    .from("payouts")
    .select("*")
    .eq("id", input.payoutId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (row.status !== "failed") return { ok: false, error: "invalid_status" };

  await db()
    .from("payouts")
    .update({ status: "retrying", updated_at: new Date().toISOString() })
    .eq("id", input.payoutId);

  return processPayout({ payoutId: input.payoutId });
}
