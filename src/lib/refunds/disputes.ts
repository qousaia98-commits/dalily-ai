/**
 * Sprint 6 Phase 5 — payment disputes (Stripe chargebacks).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { DisputeStatus, PaymentDispute } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapDispute(row: Record<string, unknown>): PaymentDispute {
  return {
    id: String(row.id),
    paymentId: row.payment_id ? String(row.payment_id) : null,
    providerId: row.provider_id ? String(row.provider_id) : null,
    stripeDisputeId: row.stripe_dispute_id
      ? String(row.stripe_dispute_id)
      : null,
    stripeChargeId: row.stripe_charge_id
      ? String(row.stripe_charge_id)
      : null,
    status: row.status as DisputeStatus,
    reason: row.reason ? String(row.reason) : null,
    amount: row.amount != null ? Number(row.amount) : null,
    currency: String(row.currency ?? "USD"),
    evidenceDueBy: row.evidence_due_by ? String(row.evidence_due_by) : null,
    resolution: row.resolution ? String(row.resolution) : null,
    openedAt: String(row.opened_at ?? row.created_at),
    closedAt: row.closed_at ? String(row.closed_at) : null,
  };
}

function mapStripeDisputeStatus(status: string): DisputeStatus {
  switch (status) {
    case "warning_needs_response":
    case "needs_response":
      return "evidence_requested";
    case "warning_under_review":
    case "under_review":
      return "under_review";
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "warning_closed":
    case "charge_refunded":
      return "closed";
    default:
      return "opened";
  }
}

export async function upsertDisputeFromStripe(input: {
  stripeDisputeId: string;
  stripeChargeId?: string | null;
  paymentId?: string | null;
  providerId?: string | null;
  status: string;
  reason?: string | null;
  amount?: number | null;
  currency?: string | null;
  evidenceDueBy?: number | null;
  resolution?: string | null;
  closed?: boolean;
}): Promise<PaymentDispute> {
  const status = mapStripeDisputeStatus(input.status);
  const patch = {
    stripe_dispute_id: input.stripeDisputeId,
    stripe_charge_id: input.stripeChargeId ?? null,
    payment_id: input.paymentId ?? null,
    provider_id: input.providerId ?? null,
    status,
    reason: input.reason ?? null,
    amount: input.amount ?? null,
    currency: (input.currency ?? "usd").toUpperCase(),
    evidence_due_by: input.evidenceDueBy
      ? new Date(input.evidenceDueBy * 1000).toISOString()
      : null,
    resolution: input.resolution ?? null,
    closed_at:
      input.closed || ["won", "lost", "closed"].includes(status)
        ? new Date().toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await db()
    .from("payment_disputes")
    .select("id, status")
    .eq("stripe_dispute_id", input.stripeDisputeId)
    .maybeSingle();

  let row;
  if (existing) {
    const { data } = await db()
      .from("payment_disputes")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    row = data;
    void emitAiLearningEvent({
      eventType: ["won", "lost", "closed"].includes(status)
        ? "dispute_closed"
        : "dispute_updated",
      providerId: input.providerId,
      metadata: { anonymized: true, status },
    });
  } else {
    const { data } = await db()
      .from("payment_disputes")
      .insert(patch)
      .select("*")
      .single();
    row = data;
    void emitAiLearningEvent({
      eventType: "dispute_opened",
      providerId: input.providerId,
      metadata: { anonymized: true },
    });
  }

  return mapDispute(row);
}

export async function addDisputeEvidence(input: {
  disputeId: string;
  uploadedBy: string;
  storagePath: string;
  fileName?: string;
  mimeType?: string;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db().from("dispute_evidence").insert({
    dispute_id: input.disputeId,
    uploaded_by: input.uploadedBy,
    storage_path: input.storagePath,
    file_name: input.fileName ?? null,
    mime_type: input.mimeType ?? null,
    note: input.note ?? null,
  });
  if (error) return { ok: false, error: error.message };

  await db()
    .from("payment_disputes")
    .update({
      status: "evidence_submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.disputeId)
    .in("status", ["opened", "evidence_requested", "under_review"]);

  void emitAiLearningEvent({
    eventType: "dispute_evidence_uploaded",
    metadata: { anonymized: true },
  });

  return { ok: true };
}

export async function listDisputes(input: {
  providerId?: string | null;
  status?: DisputeStatus | "all";
  limit?: number;
}): Promise<PaymentDispute[]> {
  try {
    let q = db()
      .from("payment_disputes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 100);
    if (input.providerId) q = q.eq("provider_id", input.providerId);
    if (input.status && input.status !== "all") q = q.eq("status", input.status);
    const { data } = await q;
    return (data ?? []).map(mapDispute);
  } catch {
    return [];
  }
}

export async function getDisputeById(
  disputeId: string,
): Promise<PaymentDispute | null> {
  const { data } = await db()
    .from("payment_disputes")
    .select("*")
    .eq("id", disputeId)
    .maybeSingle();
  return data ? mapDispute(data) : null;
}
