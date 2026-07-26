/**
 * Sprint 5 Phase 5 — project approval workflow.
 * Customers approve / reject; AI never decides.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logProjectActivity } from "./activity";
import type { CollabApproval, CollabApprovalKind } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapApproval(row: Record<string, unknown>): CollabApproval {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    packageId: row.package_id ? String(row.package_id) : null,
    kind: row.kind as CollabApprovalKind,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    status: row.status as CollabApproval["status"],
    decidedAt: row.decided_at ? String(row.decided_at) : null,
    decisionNote: row.decision_note ? String(row.decision_note) : null,
    createdAt: String(row.created_at),
  };
}

export async function listProjectApprovals(
  projectId: string,
): Promise<CollabApproval[]> {
  try {
    const { data } = await db()
      .from("project_approvals")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    return (data ?? []).map(mapApproval);
  } catch {
    return [];
  }
}

export async function requestProjectApproval(input: {
  projectId: string;
  kind: CollabApprovalKind;
  title: string;
  description?: string | null;
  packageId?: string | null;
  requestedBy?: string | null;
}): Promise<{ ok: true; approval: CollabApproval } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "empty_title" };

  try {
    const { data, error } = await db()
      .from("project_approvals")
      .insert({
        project_id: input.projectId,
        package_id: input.packageId ?? null,
        kind: input.kind,
        title,
        description: input.description?.trim() || null,
        requested_by: input.requestedBy ?? null,
      })
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };

    const approval = mapApproval(data);
    await logProjectActivity({
      projectId: input.projectId,
      packageId: input.packageId,
      eventKey: "approval_requested",
      labelEn: `Approval requested: ${title}`,
      labelAr: `طلب موافقة: ${title}`,
      actor: "provider",
      actorUserId: input.requestedBy,
      payload: { approvalId: approval.id, kind: input.kind },
    });

    return { ok: true, approval };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "request_failed" };
  }
}

export async function decideProjectApproval(input: {
  projectId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  note?: string | null;
  decidedBy?: string | null;
}): Promise<{ ok: true; approval: CollabApproval } | { ok: false; error: string }> {
  try {
    const { data, error } = await db()
      .from("project_approvals")
      .update({
        status: input.decision,
        decided_by: input.decidedBy ?? null,
        decided_at: new Date().toISOString(),
        decision_note: input.note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.approvalId)
      .eq("project_id", input.projectId)
      .eq("status", "pending")
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "decide_failed" };

    const approval = mapApproval(data);
    const accepted = input.decision === "approved";
    await logProjectActivity({
      projectId: input.projectId,
      packageId: approval.packageId,
      eventKey: accepted ? "approval_accepted" : "approval_rejected",
      labelEn: accepted
        ? `Approved: ${approval.title}`
        : `Rejected: ${approval.title}`,
      labelAr: accepted
        ? `تمت الموافقة: ${approval.title}`
        : `تم الرفض: ${approval.title}`,
      actor: "customer",
      actorUserId: input.decidedBy,
      payload: { approvalId: approval.id, decision: input.decision },
    });

    return { ok: true, approval };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "decide_failed" };
  }
}
