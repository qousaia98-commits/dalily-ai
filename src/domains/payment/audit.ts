/**
 * RC2.1 P0 — Immutable financial audit trail (append-only via service role).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import type { AppRole } from "@/types/database.types";

export type FinancialAuditAction =
  | "wallet_ledger"
  | "escrow_create"
  | "escrow_release"
  | "escrow_refund"
  | "escrow_dispute"
  | "escrow_cancel"
  | "payout_create"
  | "payout_process"
  | "payout_retry"
  | "payment_transition"
  | "admin_wallet_credit";

export async function logFinancialAudit(input: {
  actorId: string | null;
  actorRoles?: AppRole[] | null;
  action: FinancialAuditAction;
  objectType: string;
  objectId: string;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  result: "success" | "failure" | "rejected";
  correlationId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { error } = await admin.from("financial_audit_logs").insert({
      actor_id: input.actorId,
      actor_roles: input.actorRoles ?? [],
      action: input.action,
      object_type: input.objectType,
      object_id: input.objectId,
      old_state: input.oldState ?? {},
      new_state: input.newState ?? {},
      result: input.result,
      correlation_id: input.correlationId ?? null,
      ip: input.ip ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      logger.error("financial_audit", "insert_failed", {
        action: input.action,
        error: error.message,
      });
    }
  } catch (e) {
    logger.error("financial_audit", "insert_exception", {
      action: input.action,
      error: e instanceof Error ? e.message : "unknown",
    });
  }
}
