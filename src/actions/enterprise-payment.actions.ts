"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser, requireFinanceUser } from "@/lib/auth/session";
import {
  isEscrowEngineEnabled,
  isPaymentWalletEnabled,
  isPayoutsEnabled,
  isPaymentsV2Enabled,
} from "@/lib/config/feature-flags";
import { applyWalletLedgerEntry, getOrCreateWallet } from "@/domains/payment/wallet/service";
import {
  releaseEscrow,
  holdEscrowForDispute,
  refundEscrow,
} from "@/domains/payment/escrow/engine";
import { retryPayout, processPayout } from "@/domains/payment/payouts/engine";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { logFinancialAudit } from "@/domains/payment/audit";

export type WalletActionResult =
  | { ok: true }
  | { ok: false; error: string };

/** Finance / Super Admin: credit wallet (bonus / adjustment). Not a public top-up rail. */
export async function adminCreditWallet(input: {
  userId: string;
  amount: number;
  currency?: string;
  description?: string;
  idempotencyKey: string;
}): Promise<WalletActionResult> {
  const admin = await requireFinanceUser();
  if (!isPaymentsV2Enabled() || !isPaymentWalletEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  if (!(input.amount > 0)) return { ok: false, error: "invalid_amount" };

  const rate = checkRateLimit(rateLimitKey("admin_wallet_credit", input.userId), {
    max: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) return { ok: false, error: "rate_limited" };

  await getOrCreateWallet({ userId: input.userId, currency: input.currency });
  const result = await applyWalletLedgerEntry({
    userId: input.userId,
    entryType: "bonus",
    amount: input.amount,
    currency: input.currency,
    idempotencyKey: input.idempotencyKey,
    description: input.description ?? "Admin wallet credit",
    actorId: admin.id,
  });

  await logFinancialAudit({
    actorId: admin.id,
    actorRoles: admin.roles,
    action: "admin_wallet_credit",
    objectType: "wallet_user",
    objectId: input.userId,
    newState: { amount: input.amount, currency: input.currency ?? "SYP" },
    result: result.ok ? "success" : "failure",
    correlationId: input.idempotencyKey,
    metadata: result.ok ? {} : { error: result.error },
  });

  if (result.ok) {
    revalidatePath("/admin/payments");
    revalidatePath("/admin/wallet");
    revalidatePath("/account/wallet");
  }
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function adminReleaseEscrow(input: {
  escrowId: string;
}): Promise<WalletActionResult> {
  const admin = await requireFinanceUser();
  if (!isEscrowEngineEnabled()) return { ok: false, error: "feature_disabled" };

  const result = await releaseEscrow({
    escrowId: input.escrowId,
    actorId: admin.id,
    actorRoles: admin.roles,
    emergencyAdmin: true,
  });
  if (result.ok) {
    revalidatePath("/admin/wallet");
    revalidatePath("/admin/payments");
  }
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function openEscrowDisputeAction(input: {
  escrowId: string;
  reasonCode: string;
  details?: string;
}): Promise<WalletActionResult> {
  const user = await requireAuthUser();
  if (!isEscrowEngineEnabled()) return { ok: false, error: "feature_disabled" };

  const result = await holdEscrowForDispute({
    escrowId: input.escrowId,
    actorId: user.id,
    actorRoles: user.roles,
    reasonCode: input.reasonCode,
    details: input.details,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function adminRefundEscrow(input: {
  escrowId: string;
  amount?: number;
  reason?: string;
}): Promise<WalletActionResult> {
  const admin = await requireFinanceUser();
  if (!isEscrowEngineEnabled()) return { ok: false, error: "feature_disabled" };

  const result = await refundEscrow({
    escrowId: input.escrowId,
    actorId: admin.id,
    actorRoles: admin.roles,
    amount: input.amount,
    reason: input.reason,
    requireFinance: true,
  });
  if (result.ok) revalidatePath("/admin/wallet");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function adminRetryPayout(input: {
  payoutId: string;
}): Promise<WalletActionResult> {
  const admin = await requireFinanceUser();
  if (!isPayoutsEnabled()) return { ok: false, error: "feature_disabled" };

  const result = await retryPayout({ payoutId: input.payoutId });
  await logFinancialAudit({
    actorId: admin.id,
    actorRoles: admin.roles,
    action: "payout_retry",
    objectType: "payout",
    objectId: input.payoutId,
    result: result.ok ? "success" : "failure",
    metadata: result.ok ? {} : { error: result.error },
  });
  if (result.ok) revalidatePath("/admin/wallet");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function adminProcessPayout(input: {
  payoutId: string;
}): Promise<WalletActionResult> {
  const admin = await requireFinanceUser();
  if (!isPayoutsEnabled()) return { ok: false, error: "feature_disabled" };

  const result = await processPayout({ payoutId: input.payoutId });
  await logFinancialAudit({
    actorId: admin.id,
    actorRoles: admin.roles,
    action: "payout_process",
    objectType: "payout",
    objectId: input.payoutId,
    result: result.ok ? "success" : "failure",
    metadata: result.ok ? {} : { error: result.error },
  });
  if (result.ok) revalidatePath("/admin/wallet");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
