/**
 * Escrow engine — reserve → release / refund / dispute (provider-agnostic).
 * RC2.1: CAS status transitions, immutable metadata merge, party/finance authz.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isEscrowEngineEnabled, isPayoutsEnabled } from "@/lib/config/feature-flags";
import { calculateFeeBreakdown } from "@/domains/payment/fees/engine";
import { applyWalletLedgerEntry } from "@/domains/payment/wallet/service";
import { createPayout } from "@/domains/payment/payouts/engine";
import { emitPaymentTimelineEvent } from "@/domains/payment/shared/timeline";
import { transitionPaymentStatus } from "@/lib/payment/orchestration";
import { canTransitionEscrowStatus } from "@/lib/payment/state-machine";
import { assertEscrowActorAllowed } from "@/domains/payment/authz";
import { logFinancialAudit } from "@/domains/payment/audit";
import type { AppRole } from "@/types/database.types";
import type { EscrowHoldView, EscrowStatus } from "@/domains/payment/shared/types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapEscrow(row: Record<string, unknown>): EscrowHoldView {
  return {
    id: String(row.id),
    paymentId: row.payment_id ? String(row.payment_id) : null,
    serviceRequestId: row.service_request_id
      ? String(row.service_request_id)
      : null,
    conversationId: row.conversation_id ? String(row.conversation_id) : null,
    customerId: String(row.customer_id),
    providerId: String(row.provider_id),
    amount: Number(row.amount),
    currency: String(row.currency ?? "SYP"),
    platformFee: Number(row.platform_fee ?? 0),
    providerAmount: Number(row.provider_amount ?? 0),
    status: row.status as EscrowStatus,
    reservedAt: row.reserved_at ? String(row.reserved_at) : null,
    releasedAt: row.released_at ? String(row.released_at) : null,
    createdAt: String(row.created_at),
  };
}

function fundedViaFromMetadata(metadata: unknown): "external" | "wallet" {
  if (metadata && typeof metadata === "object") {
    const v = (metadata as Record<string, unknown>).fundedVia;
    if (v === "wallet") return "wallet";
  }
  return "external";
}

function mergeEscrowMetadata(
  existing: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

export async function getEscrowById(id: string): Promise<EscrowHoldView | null> {
  if (!isEscrowEngineEnabled()) return null;
  const { data } = await db().from("escrow_holds").select("*").eq("id", id).maybeSingle();
  return data ? mapEscrow(data) : null;
}

async function getEscrowRow(id: string): Promise<Record<string, unknown> | null> {
  const { data } = await db().from("escrow_holds").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function listEscrows(input: {
  customerId?: string;
  providerId?: string;
  status?: EscrowStatus | "all";
  limit?: number;
}): Promise<EscrowHoldView[]> {
  if (!isEscrowEngineEnabled()) return [];

  // When both party filters are set, return the union (viewer may be customer and/or provider).
  if (input.customerId && input.providerId) {
    const [asCustomer, asProvider] = await Promise.all([
      listEscrows({
        customerId: input.customerId,
        status: input.status,
        limit: input.limit,
      }),
      listEscrows({
        providerId: input.providerId,
        status: input.status,
        limit: input.limit,
      }),
    ]);
    const map = new Map<string, EscrowHoldView>();
    for (const e of [...asCustomer, ...asProvider]) map.set(e.id, e);
    return [...map.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, input.limit ?? 50);
  }

  let q = db()
    .from("escrow_holds")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);
  if (input.customerId) q = q.eq("customer_id", input.customerId);
  if (input.providerId) q = q.eq("provider_id", input.providerId);
  if (input.status && input.status !== "all") q = q.eq("status", input.status);
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapEscrow);
}

/**
 * Create escrow hold after customer payment is authorized/captured.
 * Optionally reserves from customer wallet when fundedVia=wallet.
 */
export async function createEscrowHold(input: {
  customerId: string;
  providerId: string;
  amount: number;
  currency?: string;
  paymentId?: string | null;
  serviceRequestId?: string | null;
  conversationId?: string | null;
  bookingId?: string | null;
  idempotencyKey: string;
  fundedVia?: "external" | "wallet";
  actorId?: string;
}): Promise<
  { ok: true; escrow: EscrowHoldView } | { ok: false; error: string }
> {
  if (!isEscrowEngineEnabled()) return { ok: false, error: "feature_disabled" };
  if (!(input.amount > 0)) return { ok: false, error: "invalid_amount" };

  const { data: existing } = await db()
    .from("escrow_holds")
    .select("*")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) return { ok: true, escrow: mapEscrow(existing) };

  const fees = await calculateFeeBreakdown({
    amount: input.amount,
    currency: input.currency,
  });

  if (input.fundedVia === "wallet") {
    const reserved = await applyWalletLedgerEntry({
      userId: input.customerId,
      entryType: "reserve",
      amount: input.amount,
      currency: input.currency,
      paymentId: input.paymentId,
      idempotencyKey: `escrow-reserve:${input.idempotencyKey}`,
      description: "Escrow reserve",
      actorId: input.actorId ?? input.customerId,
    });
    if (!reserved.ok) return { ok: false, error: reserved.error };
  }

  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("escrow_holds")
    .insert({
      payment_id: input.paymentId ?? null,
      service_request_id: input.serviceRequestId ?? null,
      booking_id: input.bookingId ?? null,
      conversation_id: input.conversationId ?? null,
      customer_id: input.customerId,
      provider_id: input.providerId,
      amount: input.amount,
      currency: input.currency ?? fees.currency,
      platform_fee: fees.platformFee,
      provider_amount: fees.netToProvider,
      status: "reserved",
      reserved_at: now,
      idempotency_key: input.idempotencyKey,
      metadata: { fundedVia: input.fundedVia ?? "external", fees },
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "create_failed" };
  }

  if (input.paymentId) {
    await transitionPaymentStatus({
      paymentId: input.paymentId,
      toStatus: "reserved",
      source: "system",
      note: "escrow_reserved",
      actorUserId: input.actorId,
    });
  }

  await emitPaymentTimelineEvent({
    conversationId: input.conversationId,
    actorId: input.actorId ?? input.customerId,
    event: "payment_reserved",
  });

  await logFinancialAudit({
    actorId: input.actorId ?? input.customerId,
    action: "escrow_create",
    objectType: "escrow",
    objectId: String(data.id),
    newState: { status: "reserved", amount: input.amount },
    result: "success",
    correlationId: input.idempotencyKey,
  });

  return { ok: true, escrow: mapEscrow(data) };
}

/**
 * Release escrow on booking completion → provider payout.
 */
export async function releaseEscrow(input: {
  escrowId: string;
  actorId: string;
  actorRoles?: AppRole[];
  emergencyAdmin?: boolean;
}): Promise<{ ok: true; escrow: EscrowHoldView } | { ok: false; error: string }> {
  if (!isEscrowEngineEnabled()) return { ok: false, error: "feature_disabled" };

  const row = await getEscrowRow(input.escrowId);
  if (!row) return { ok: false, error: "not_found" };
  const escrow = mapEscrow(row);

  if (input.emergencyAdmin || input.actorRoles) {
    const gate = await assertEscrowActorAllowed({
      escrow,
      actorId: input.actorId,
      roles: input.actorRoles,
      financeOnly: Boolean(input.emergencyAdmin),
    });
    if (!gate.ok) return { ok: false, error: gate.error };
  }

  if (escrow.status === "released") return { ok: true, escrow };
  if (escrow.status === "disputed" && !input.emergencyAdmin) {
    return { ok: false, error: "disputed_hold" };
  }
  if (!canTransitionEscrowStatus(escrow.status, "released")) {
    return { ok: false, error: "invalid_status" };
  }

  const fundedVia = fundedViaFromMetadata(row.metadata);
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("escrow_holds")
    .update({
      status: "released",
      released_at: now,
      updated_at: now,
      metadata: mergeEscrowMetadata(row.metadata, {
        releasedBy: input.actorId,
        releasedAt: now,
      }),
    })
    .eq("id", input.escrowId)
    .in("status", ["reserved", "disputed"])
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "invalid_status" };

  // Wallet-funded: clear reserved (funds leave customer wallet → provider payout)
  if (fundedVia === "wallet") {
    const released = await applyWalletLedgerEntry({
      userId: escrow.customerId,
      entryType: "release",
      amount: escrow.amount,
      currency: escrow.currency,
      escrowId: escrow.id,
      paymentId: escrow.paymentId,
      idempotencyKey: `escrow-release-wallet:${escrow.id}`,
      description: "Escrow settled — clear reserve",
      actorId: input.actorId,
    });
    if (!released.ok && released.error !== "idempotent_replay") {
      // Status already CAS'd — audit failure for ops; do not double-release money
      await logFinancialAudit({
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: "escrow_release",
        objectType: "escrow",
        objectId: escrow.id,
        oldState: { status: escrow.status },
        newState: { status: "released", walletError: released.error },
        result: "failure",
      });
    }
  }

  if (isPayoutsEnabled() && escrow.providerAmount > 0) {
    const { data: provider } = await db()
      .from("providers")
      .select("id, owner_id")
      .eq("id", escrow.providerId)
      .maybeSingle();

    if (provider?.owner_id) {
      const payout = await createPayout({
        providerId: escrow.providerId,
        ownerUserId: String(provider.owner_id),
        amount: escrow.providerAmount,
        currency: escrow.currency,
        method: "wallet",
        escrowId: escrow.id,
        paymentId: escrow.paymentId,
        idempotencyKey: `payout-escrow:${escrow.id}`,
        processImmediately: true,
      });
      if (!payout.ok) {
        await logFinancialAudit({
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          action: "escrow_release",
          objectType: "escrow",
          objectId: escrow.id,
          oldState: { status: escrow.status },
          newState: { status: "released", payoutError: payout.error },
          result: "failure",
          metadata: { note: "escrow_released_payout_failed" },
        });
      }
    }
  }

  if (escrow.paymentId) {
    await transitionPaymentStatus({
      paymentId: escrow.paymentId,
      toStatus: "released",
      actorUserId: input.actorId,
      source: input.emergencyAdmin ? "admin" : "system",
      note: "escrow_released",
    });
  }

  await emitPaymentTimelineEvent({
    conversationId: escrow.conversationId,
    actorId: input.actorId,
    event: "payment_completed",
  });

  await logFinancialAudit({
    actorId: input.actorId,
    actorRoles: input.actorRoles,
    action: "escrow_release",
    objectType: "escrow",
    objectId: escrow.id,
    oldState: { status: escrow.status },
    newState: { status: "released" },
    result: "success",
  });

  return { ok: true, escrow: mapEscrow(data) };
}

/**
 * Refund escrow. Never both release-to-provider and refund.
 * Preserves immutable fundedVia in metadata; clears reserve then credits refund for wallet rails.
 */
export async function refundEscrow(input: {
  escrowId: string;
  actorId: string;
  actorRoles?: AppRole[];
  amount?: number;
  reason?: string;
  requireFinance?: boolean;
}): Promise<{ ok: true; escrow: EscrowHoldView } | { ok: false; error: string }> {
  if (!isEscrowEngineEnabled()) return { ok: false, error: "feature_disabled" };
  const row = await getEscrowRow(input.escrowId);
  if (!row) return { ok: false, error: "not_found" };
  const escrow = mapEscrow(row);

  if (input.requireFinance !== false && input.actorRoles) {
    const gate = await assertEscrowActorAllowed({
      escrow,
      actorId: input.actorId,
      roles: input.actorRoles,
      financeOnly: true,
    });
    if (!gate.ok) return { ok: false, error: gate.error };
  }

  const refundAmount = input.amount ?? escrow.amount;
  if (!(refundAmount > 0) || refundAmount > escrow.amount) {
    return { ok: false, error: "invalid_amount" };
  }

  const partial = refundAmount < escrow.amount;
  const toStatus = partial ? "partially_refunded" : "refunded";
  if (!canTransitionEscrowStatus(escrow.status, toStatus)) {
    return { ok: false, error: "invalid_status" };
  }

  const fundedVia = fundedViaFromMetadata(row.metadata);

  // Wallet rail first (idempotent): Reserve → Refund. Never Release→provider.
  if (fundedVia === "wallet") {
    const cleared = await applyWalletLedgerEntry({
      userId: escrow.customerId,
      entryType: "release",
      amount: refundAmount,
      currency: escrow.currency,
      escrowId: escrow.id,
      paymentId: escrow.paymentId,
      idempotencyKey: `escrow-refund-release:${escrow.id}:${refundAmount}`,
      description: "Escrow refund — clear reserve",
      actorId: input.actorId,
    });
    if (!cleared.ok) {
      await logFinancialAudit({
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: "escrow_refund",
        objectType: "escrow",
        objectId: escrow.id,
        oldState: { status: escrow.status, fundedVia },
        newState: { reserveError: cleared.error },
        result: "failure",
      });
      return { ok: false, error: cleared.error };
    }
  }

  const credited = await applyWalletLedgerEntry({
    userId: escrow.customerId,
    entryType: "refund",
    amount: refundAmount,
    currency: escrow.currency,
    escrowId: escrow.id,
    paymentId: escrow.paymentId,
    idempotencyKey: `escrow-refund:${escrow.id}:${refundAmount}`,
    description: input.reason ?? "Escrow refund",
    actorId: input.actorId,
  });
  if (!credited.ok) {
    await logFinancialAudit({
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      action: "escrow_refund",
      objectType: "escrow",
      objectId: escrow.id,
      oldState: { status: escrow.status, fundedVia },
      newState: { creditError: credited.error },
      result: "failure",
    });
    return { ok: false, error: credited.error };
  }

  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("escrow_holds")
    .update({
      status: toStatus,
      refunded_at: now,
      updated_at: now,
      metadata: mergeEscrowMetadata(row.metadata, {
        refund: {
          amount: refundAmount,
          reason: input.reason ?? null,
          at: now,
          by: input.actorId,
        },
      }),
    })
    .eq("id", input.escrowId)
    .in("status", ["reserved", "disputed"])
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    // Concurrent CAS — wallet ops were idempotent; treat same terminal as success
    const again = await getEscrowById(input.escrowId);
    if (again && (again.status === "refunded" || again.status === "partially_refunded")) {
      return { ok: true, escrow: again };
    }
    return { ok: false, error: "invalid_status" };
  }

  if (escrow.paymentId) {
    await transitionPaymentStatus({
      paymentId: escrow.paymentId,
      toStatus: partial ? "partially_refunded" : "refunded",
      actorUserId: input.actorId,
      source: "admin",
      note: "escrow_refunded",
    });
  }

  await emitPaymentTimelineEvent({
    conversationId: escrow.conversationId,
    actorId: input.actorId,
    event: "payment_refunded",
  });

  await logFinancialAudit({
    actorId: input.actorId,
    actorRoles: input.actorRoles,
    action: "escrow_refund",
    objectType: "escrow",
    objectId: escrow.id,
    oldState: { status: escrow.status, fundedVia },
    newState: { status: toStatus, refundAmount },
    result: "success",
  });

  return { ok: true, escrow: mapEscrow(data) };
}

export async function holdEscrowForDispute(input: {
  escrowId: string;
  actorId: string;
  actorRoles?: AppRole[];
  reasonCode: string;
  details?: string;
}): Promise<{ ok: true; escrow: EscrowHoldView } | { ok: false; error: string }> {
  if (!isEscrowEngineEnabled()) return { ok: false, error: "feature_disabled" };
  const row = await getEscrowRow(input.escrowId);
  if (!row) return { ok: false, error: "not_found" };
  const escrow = mapEscrow(row);

  const gate = await assertEscrowActorAllowed({
    escrow,
    actorId: input.actorId,
    roles: input.actorRoles,
    financeOnly: false,
  });
  if (!gate.ok) {
    await logFinancialAudit({
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      action: "escrow_dispute",
      objectType: "escrow",
      objectId: escrow.id,
      oldState: { status: escrow.status },
      result: "rejected",
      metadata: { reason: "forbidden" },
    });
    return { ok: false, error: gate.error };
  }

  if (!canTransitionEscrowStatus(escrow.status, "disputed")) {
    return { ok: false, error: "invalid_status" };
  }

  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("escrow_holds")
    .update({
      status: "disputed",
      disputed_at: now,
      updated_at: now,
      metadata: mergeEscrowMetadata(row.metadata, {
        dispute: {
          reasonCode: input.reasonCode,
          details: input.details ?? null,
          openedBy: input.actorId,
          at: now,
        },
      }),
    })
    .eq("id", input.escrowId)
    .eq("status", "reserved")
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "invalid_status" };

  await db().from("marketplace_payment_disputes").insert({
    escrow_id: escrow.id,
    payment_id: escrow.paymentId,
    opened_by: input.actorId,
    status: "open",
    reason_code: input.reasonCode,
    details: input.details ?? null,
  });

  if (escrow.paymentId) {
    await transitionPaymentStatus({
      paymentId: escrow.paymentId,
      toStatus: "disputed",
      actorUserId: input.actorId,
      source: "user",
      note: "escrow_disputed",
    });
  }

  await emitPaymentTimelineEvent({
    conversationId: escrow.conversationId,
    actorId: input.actorId,
    event: "dispute_opened",
  });

  await logFinancialAudit({
    actorId: input.actorId,
    actorRoles: input.actorRoles,
    action: "escrow_dispute",
    objectType: "escrow",
    objectId: escrow.id,
    oldState: { status: escrow.status },
    newState: { status: "disputed", reasonCode: input.reasonCode },
    result: "success",
  });

  return { ok: true, escrow: mapEscrow(data) };
}

export async function cancelEscrow(input: {
  escrowId: string;
  actorId: string;
  actorRoles?: AppRole[];
}): Promise<{ ok: true; escrow: EscrowHoldView } | { ok: false; error: string }> {
  if (!isEscrowEngineEnabled()) return { ok: false, error: "feature_disabled" };
  const row = await getEscrowRow(input.escrowId);
  if (!row) return { ok: false, error: "not_found" };
  const escrow = mapEscrow(row);

  if (!canTransitionEscrowStatus(escrow.status, "cancelled")) {
    return { ok: false, error: "invalid_status" };
  }

  const fundedVia = fundedViaFromMetadata(row.metadata);
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("escrow_holds")
    .update({
      status: "cancelled",
      updated_at: now,
      metadata: mergeEscrowMetadata(row.metadata, {
        cancelledBy: input.actorId,
        cancelledAt: now,
      }),
    })
    .eq("id", input.escrowId)
    .in("status", ["pending", "reserved"])
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "invalid_status" };

  if (fundedVia === "wallet" && escrow.status === "reserved") {
    await applyWalletLedgerEntry({
      userId: escrow.customerId,
      entryType: "release",
      amount: escrow.amount,
      currency: escrow.currency,
      escrowId: escrow.id,
      idempotencyKey: `escrow-cancel-release:${escrow.id}`,
      description: "Escrow cancelled — release reserve",
      actorId: input.actorId,
    });
    await applyWalletLedgerEntry({
      userId: escrow.customerId,
      entryType: "credit",
      amount: escrow.amount,
      currency: escrow.currency,
      escrowId: escrow.id,
      idempotencyKey: `escrow-cancel-credit:${escrow.id}`,
      description: "Escrow cancelled — restore available",
      actorId: input.actorId,
    });
  }

  if (escrow.paymentId) {
    await transitionPaymentStatus({
      paymentId: escrow.paymentId,
      toStatus: "cancelled",
      actorUserId: input.actorId,
      source: "system",
      note: "escrow_cancelled",
    });
  }

  await logFinancialAudit({
    actorId: input.actorId,
    actorRoles: input.actorRoles,
    action: "escrow_cancel",
    objectType: "escrow",
    objectId: escrow.id,
    oldState: { status: escrow.status },
    newState: { status: "cancelled" },
    result: "success",
  });

  return { ok: true, escrow: mapEscrow(data) };
}
