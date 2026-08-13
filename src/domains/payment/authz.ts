/**
 * RC2.1 P0 — Payment / escrow / refund access control.
 * Never trust client identifiers alone.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { canManageFinance } from "@/lib/auth/roles";
import { getPaymentById } from "@/lib/payment/orchestration";
import { getOwnedProvider } from "@/lib/providers/database";
import type { AppRole } from "@/types/database.types";
import type { EscrowHoldView } from "@/domains/payment/shared/types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function isProviderOwnerOf(
  userId: string,
  providerId: string,
): Promise<boolean> {
  const owned = await getOwnedProvider(userId);
  return owned?.id === providerId;
}

/** Customer id may live on escrow or payment.metadata.customer_id / customerId. */
export function customerIdFromPaymentMetadata(
  metadata: unknown,
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const id = m.customer_id ?? m.customerId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function canAccessPayment(input: {
  paymentId: string;
  userId: string;
  roles: AppRole[];
}): Promise<boolean> {
  if (canManageFinance(input.roles)) return true;

  const payment = await getPaymentById(input.paymentId);
  if (!payment) return false;

  if (await isProviderOwnerOf(input.userId, payment.providerId)) return true;

  const { data: row } = await db()
    .from("payments")
    .select("metadata")
    .eq("id", input.paymentId)
    .maybeSingle();
  const customerId = customerIdFromPaymentMetadata(row?.metadata);
  if (customerId && customerId === input.userId) return true;

  const { data: escrow } = await db()
    .from("escrow_holds")
    .select("id")
    .eq("payment_id", input.paymentId)
    .eq("customer_id", input.userId)
    .limit(1)
    .maybeSingle();
  if (escrow) return true;

  return false;
}

export async function canAccessEscrow(input: {
  escrow: EscrowHoldView;
  userId: string;
  roles: AppRole[];
}): Promise<boolean> {
  if (canManageFinance(input.roles)) return true;
  if (input.escrow.customerId === input.userId) return true;
  return isProviderOwnerOf(input.userId, input.escrow.providerId);
}

/**
 * Customer, provider owner, or finance/super-admin may act on escrow disputes.
 * financeOnly=true restricts to finance/super-admin (release/refund money paths).
 */
export async function assertEscrowActorAllowed(input: {
  escrow: EscrowHoldView;
  actorId: string;
  roles?: AppRole[];
  financeOnly?: boolean;
}): Promise<{ ok: true } | { ok: false; error: "forbidden" }> {
  if (input.financeOnly) {
    if (input.roles && canManageFinance(input.roles)) return { ok: true };
    return { ok: false, error: "forbidden" };
  }

  if (input.roles && canManageFinance(input.roles)) return { ok: true };
  if (input.escrow.customerId === input.actorId) return { ok: true };
  if (await isProviderOwnerOf(input.actorId, input.escrow.providerId)) {
    return { ok: true };
  }
  return { ok: false, error: "forbidden" };
}

export async function canAccessRefund(input: {
  refund: {
    providerId: string;
    requestedBy: string | null;
    paymentId: string;
  };
  userId: string;
  roles: AppRole[];
}): Promise<boolean> {
  if (canManageFinance(input.roles)) return true;
  if (input.refund.requestedBy === input.userId) return true;
  if (await isProviderOwnerOf(input.userId, input.refund.providerId)) {
    return true;
  }
  return canAccessPayment({
    paymentId: input.refund.paymentId,
    userId: input.userId,
    roles: input.roles,
  });
}
