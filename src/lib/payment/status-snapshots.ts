/**
 * Sprint 6 Phase 2 — append-only payment status snapshots (immutable history).
 */

import { createAdminClient } from "@/lib/supabase/admin";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function snapshotPaymentStatus(input: {
  paymentId: string;
  fromStatus?: string | null;
  toStatus: string;
  actorUserId?: string | null;
  source?: "system" | "admin" | "webhook" | "provider" | "cron" | "user";
  note?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db().from("payment_status_snapshots").insert({
      payment_id: input.paymentId,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus,
      actor_user_id: input.actorUserId ?? null,
      source: input.source ?? "system",
      note: input.note ?? null,
      payload: input.payload ?? {},
    });
  } catch {
    // never break payment path
  }
}

export async function listPaymentSnapshots(paymentId: string) {
  try {
    const { data } = await db()
      .from("payment_status_snapshots")
      .select("*")
      .eq("payment_id", paymentId)
      .order("created_at", { ascending: true });
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      fromStatus: row.from_status ? String(row.from_status) : null,
      toStatus: String(row.to_status),
      source: String(row.source),
      note: row.note ? String(row.note) : null,
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}
