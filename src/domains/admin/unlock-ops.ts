/**
 * Sprint 9 — Unlock ops queue + audited admin_comp.
 * Reuses payment/unlock domains; does not capture without payment except audited comp.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminMigrationV2Enabled } from "@/lib/config/feature-flags";
import { completeUnlockSuccess } from "@/domains/unlock/session";
import { logAdminAction } from "@/lib/admin/action-log";
import type { UnlockSessionView } from "@/domains/unlock/types";

export type UnlockPaymentQueueItem = {
  paymentId: string;
  unlockSessionId: string | null;
  providerId: string;
  providerName: string | null;
  amount: number;
  currency: string;
  paymentStatus: string;
  createdAt: string;
  slaDeadline: string | null;
  sessionStatus: string | null;
};

export type UnlockOpsOverview = {
  pendingPayments: UnlockPaymentQueueItem[];
  openSessions: UnlockSessionView[];
  timedOutRecent: UnlockSessionView[];
};

export async function getUnlockOpsOverview(): Promise<UnlockOpsOverview> {
  if (!isAdminMigrationV2Enabled()) {
    return { pendingPayments: [], openSessions: [], timedOutRecent: [] };
  }

  const admin = createAdminClient();
  const [{ data: payments }, { data: openRows }, { data: timedRows }] = await Promise.all([
    admin
      .from("payments")
      .select("id, unlock_session_id, provider_id, amount, currency, payment_status, created_at")
      .eq("purpose", "unlock_fee")
      .in("payment_status", ["pending", "pending_review"])
      .order("created_at", { ascending: true })
      .limit(50),
    admin
      .from("unlock_sessions")
      .select("*")
      .in("status", ["opened", "payment_pending"])
      .order("sla_deadline", { ascending: true })
      .limit(40),
    admin
      .from("unlock_sessions")
      .select("*")
      .eq("status", "timed_out")
      .order("closed_at", { ascending: false })
      .limit(20),
  ]);

  const sessionIds = [
    ...new Set(
      (payments ?? [])
        .map((p) => p.unlock_session_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const providerIds = [
    ...new Set([
      ...(payments ?? []).map((p) => p.provider_id as string),
      ...(openRows ?? []).map((s) => s.provider_id as string),
    ]),
  ];

  const [{ data: sessions }, { data: providers }] = await Promise.all([
    sessionIds.length
      ? admin
          .from("unlock_sessions")
          .select("id, sla_deadline, status")
          .in("id", sessionIds)
      : Promise.resolve({ data: [] as { id: string; sla_deadline: string; status: string }[] }),
    providerIds.length
      ? admin.from("providers").select("id, name").in("id", providerIds)
      : Promise.resolve({ data: [] as { id: string; name: unknown }[] }),
  ]);

  const sessionMap = new Map((sessions ?? []).map((s) => [s.id as string, s]));
  const nameMap = new Map(
    (providers ?? []).map((p) => {
      const n = p.name as { en?: string; ar?: string } | null;
      return [p.id as string, n?.en || n?.ar || null];
    }),
  );

  const pendingPayments: UnlockPaymentQueueItem[] = (payments ?? []).map((p) => {
    const sid = (p.unlock_session_id as string) || null;
    const sess = sid ? sessionMap.get(sid) : null;
    return {
      paymentId: p.id as string,
      unlockSessionId: sid,
      providerId: p.provider_id as string,
      providerName: nameMap.get(p.provider_id as string) ?? null,
      amount: Number(p.amount),
      currency: (p.currency as string) || "SYP",
      paymentStatus: p.payment_status as string,
      createdAt: p.created_at as string,
      slaDeadline: (sess?.sla_deadline as string) ?? null,
      sessionStatus: (sess?.status as string) ?? null,
    };
  });

  const mapSession = (row: Record<string, unknown>): UnlockSessionView => ({
    id: row.id as string,
    selectionId: row.selection_id as string,
    serviceRequestId: row.service_request_id as string,
    providerId: row.provider_id as string,
    offerId: (row.offer_id as string) ?? null,
    status: row.status as UnlockSessionView["status"],
    feeAmount: Number(row.fee_amount ?? 0),
    feeCurrency: (row.fee_currency as string) || "SYP",
    slaDeadline: row.sla_deadline as string,
    fallbackApplied: Boolean(row.fallback_applied),
    openedAt: row.opened_at as string,
    closedAt: (row.closed_at as string) ?? null,
  });

  return {
    pendingPayments,
    openSessions: (openRows ?? []).map((r) => mapSession(r as Record<string, unknown>)),
    timedOutRecent: (timedRows ?? []).map((r) => mapSession(r as Record<string, unknown>)),
  };
}

/**
 * Comp unlock: grant without payment. Platform-admin only (enforced in action).
 * Requires non-empty audit reason. Idempotent if already succeeded.
 */
export async function compUnlockSession(input: {
  sessionId: string;
  actorId: string;
  reason: string;
}): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  if (!isAdminMigrationV2Enabled()) return { ok: false, error: "feature_disabled" };
  const reason = input.reason.trim();
  if (reason.length < 8) return { ok: false, error: "reason_required" };

  const result = await completeUnlockSuccess({
    sessionId: input.sessionId,
    actorUserId: input.actorId,
    mode: "admin_comp",
  });
  if (!result.ok) return result;

  const admin = createAdminClient();
  await admin
    .from("unlock_sessions")
    .update({ admin_comp_reason: reason.slice(0, 500) })
    .eq("id", input.sessionId);

  await logAdminAction({
    actorId: input.actorId,
    action: "unlock_comp_granted",
    entityType: "unlock_session",
    entityId: input.sessionId,
    metadata: {
      grantId: result.grantId,
      reason,
    },
  });

  return result;
}
