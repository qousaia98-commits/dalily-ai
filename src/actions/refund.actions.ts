"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthUser, requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { getOwnedProvider } from "@/lib/providers/database";
import { logAdminAudit } from "@/lib/admin/audit";
import { isRefundsDisputesEnabled } from "@/lib/config/feature-flags";
import {
  addDisputeEvidence,
  approveRefund,
  getDisputeById,
  getRefundById,
  getRefundStats,
  listDisputes,
  listRefundHistory,
  listRefunds,
  rejectRefund,
  requestRefund,
  type DisputeStatus,
  type PaymentDispute,
  type RefundRequest,
  type RefundStatus,
} from "@/lib/refunds";

function enabled(): boolean {
  return isRefundsDisputesEnabled();
}

const requestSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().positive().optional().nullable(),
  reason: z.string().trim().min(3).max(2000),
});

export async function requestRefundAction(input: {
  paymentId: string;
  amount?: number | null;
  reason: string;
}): Promise<{ ok: true; refund: RefundRequest } | { ok: false; error: string }> {
  if (!enabled()) return { ok: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const isAdmin = isPlatformAdmin(authUser.roles);
  const provider = await getOwnedProvider(authUser.id);
  if (!isAdmin && !provider) return { ok: false, error: "forbidden" };

  // Providers may only request for their own payments (enforced in requestRefund via payment.provider_id)
  if (!isAdmin && provider) {
    const { getPaymentById } = await import("@/lib/payment/orchestration");
    const payment = await getPaymentById(parsed.data.paymentId);
    if (!payment || payment.providerId !== provider.id) {
      return { ok: false, error: "forbidden" };
    }
  }

  const result = await requestRefund({
    paymentId: parsed.data.paymentId,
    amount: parsed.data.amount ?? null,
    reason: parsed.data.reason,
    requestedBy: authUser.id,
  });
  if (!result.ok) return result;

  revalidatePath("/business/payments/history");
  revalidatePath("/admin/refunds");
  revalidatePath("/admin/payments");
  return result;
}

export async function approveRefundAction(
  refundId: string,
): Promise<{ ok: true; refund: RefundRequest } | { ok: false; error: string }> {
  if (!enabled()) return { ok: false, error: "feature_disabled" };
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const result = await approveRefund({
    refundId,
    adminUserId: admin.id,
  });
  if (!result.ok) return result;

  await logAdminAudit({
    actorId: admin.id,
    action: "refund_approved",
    entityType: "refund_request",
    entityId: refundId,
    metadata: {
      paymentId: result.refund.paymentId,
      amount: result.refund.refundAmount,
      status: result.refund.status,
    },
  });

  revalidatePath("/admin/refunds");
  revalidatePath("/admin/payments");
  revalidatePath("/business/payments/history");
  return result;
}

export async function rejectRefundAction(input: {
  refundId: string;
  reason?: string;
}): Promise<{ ok: true; refund: RefundRequest } | { ok: false; error: string }> {
  if (!enabled()) return { ok: false, error: "feature_disabled" };
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const result = await rejectRefund({
    refundId: input.refundId,
    adminUserId: admin.id,
    reason: input.reason,
  });
  if (!result.ok) return result;

  await logAdminAudit({
    actorId: admin.id,
    action: "refund_rejected",
    entityType: "refund_request",
    entityId: input.refundId,
    metadata: { reason: input.reason ?? null },
  });

  revalidatePath("/admin/refunds");
  revalidatePath("/business/payments/history");
  return result;
}

export async function listMyRefundsAction(input?: {
  status?: RefundStatus | "all";
}): Promise<
  | { ok: true; refunds: RefundRequest[] }
  | { ok: false; error: string }
> {
  if (!enabled()) return { ok: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { ok: false, error: "forbidden" };

  const refunds = await listRefunds({
    providerId: provider.id,
    status: input?.status ?? "all",
    limit: 200,
  });
  return { ok: true, refunds };
}

export async function listMyDisputesAction(): Promise<
  | { ok: true; disputes: PaymentDispute[] }
  | { ok: false; error: string }
> {
  if (!enabled()) return { ok: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { ok: false, error: "forbidden" };

  const disputes = await listDisputes({
    providerId: provider.id,
    limit: 100,
  });
  return { ok: true, disputes };
}

export async function listAdminRefundsAction(input?: {
  status?: RefundStatus | "all";
  query?: string;
}): Promise<
  | {
      ok: true;
      refunds: RefundRequest[];
      stats: Awaited<ReturnType<typeof getRefundStats>>;
      disputes: PaymentDispute[];
    }
  | { ok: false; error: string }
> {
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const [refunds, stats, disputes] = await Promise.all([
    listRefunds({
      status: input?.status ?? "all",
      query: input?.query,
      limit: 300,
    }),
    getRefundStats(),
    listDisputes({ limit: 100 }),
  ]);
  return { ok: true, refunds, stats, disputes };
}

export async function getRefundDetailAction(
  refundId: string,
): Promise<
  | {
      ok: true;
      refund: RefundRequest;
      history: Awaited<ReturnType<typeof listRefundHistory>>;
    }
  | { ok: false; error: string }
> {
  if (!enabled()) return { ok: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "login_required" };

  const refund = await getRefundById(refundId);
  if (!refund) return { ok: false, error: "not_found" };

  const isAdmin = isPlatformAdmin(authUser.roles);
  if (!isAdmin) {
    const provider = await getOwnedProvider(authUser.id);
    if (!provider || provider.id !== refund.providerId) {
      return { ok: false, error: "forbidden" };
    }
  }

  const history = await listRefundHistory(refundId);
  return { ok: true, refund, history };
}

export async function addDisputeEvidenceAction(input: {
  disputeId: string;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!enabled()) return { ok: false, error: "feature_disabled" };
  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) return { ok: false, error: "forbidden" };

  const note = input.note.trim().slice(0, 4000);
  if (note.length < 3) return { ok: false, error: "invalid_input" };

  const dispute = await getDisputeById(input.disputeId);
  if (!dispute) return { ok: false, error: "not_found" };

  const path = `dispute-evidence/${input.disputeId}/${Date.now()}.note`;
  const result = await addDisputeEvidence({
    disputeId: input.disputeId,
    uploadedBy: admin.id,
    storagePath: path,
    fileName: "admin-evidence-note.txt",
    mimeType: "text/plain",
    note,
  });
  if (!result.ok) return result;

  await logAdminAudit({
    actorId: admin.id,
    action: "dispute_evidence_uploaded",
    entityType: "payment_dispute",
    entityId: input.disputeId,
    metadata: { noteLength: note.length },
  });

  revalidatePath("/admin/refunds");
  return { ok: true };
}

export type { RefundStatus, DisputeStatus };
