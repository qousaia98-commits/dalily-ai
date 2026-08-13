/**
 * Admin AI Automation control-center aggregates.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { runAdminAutomations } from "./admin";
import type { AdminAutomationDashboard } from "./types";

export async function buildAdminAutomationDashboard(): Promise<AdminAutomationDashboard> {
  // Refresh admin detections (recommendations only / confirm band)
  try {
    await runAdminAutomations();
  } catch {
    // soft
  }

  const empty: AdminAutomationDashboard = {
    version: 9,
    executedCount: 0,
    pendingApprovals: 0,
    accuracyPct: null,
    acceptanceRatePct: null,
    rejectedSuggestions: 0,
    mostSuccessfulWorkflows: [],
    recentActions: [],
    pending: [],
  };

  try {
    const admin = createAdminClient();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 14);
    const sinceIso = since.toISOString();

    const [
      { data: actions },
      { count: pendingCount },
      { data: feedback },
      { data: approvals },
    ] = await Promise.all([
      admin
        .from("ai_automation_actions")
        .select(
          "id, workflow_id, action_type, status, confidence, reason_en, created_at",
        )
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("ai_automation_approvals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("ai_automation_feedback")
        .select("user_decision")
        .gte("created_at", sinceIso)
        .limit(500),
      admin
        .from("ai_automation_approvals")
        .select("id, action_id, title_en, body_en, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const list = actions ?? [];
    const executedCount = list.filter((a) => a.status === "executed").length;
    const rejectedSuggestions = list.filter(
      (a) => a.status === "rejected",
    ).length;

    const fb = feedback ?? [];
    const accepted = fb.filter((f) => f.user_decision === "accepted").length;
    const decided = fb.filter((f) =>
      ["accepted", "rejected", "modified"].includes(String(f.user_decision)),
    ).length;
    const acceptanceRatePct =
      decided > 0 ? Math.round((accepted / decided) * 1000) / 10 : null;
    const accuracyPct =
      decided > 0
        ? Math.round(
            ((accepted +
              fb.filter((f) => f.user_decision === "modified").length * 0.5) /
              decided) *
              1000,
          ) / 10
        : null;

    const successByWorkflow = new Map<string, number>();
    for (const a of list) {
      if (a.status === "executed") {
        const id = String(a.workflow_id);
        successByWorkflow.set(id, (successByWorkflow.get(id) ?? 0) + 1);
      }
    }
    const mostSuccessfulWorkflows = [...successByWorkflow.entries()]
      .map(([workflowId, successCount]) => ({ workflowId, successCount }))
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, 8);

    return {
      version: 9,
      executedCount,
      pendingApprovals: pendingCount ?? 0,
      accuracyPct,
      acceptanceRatePct,
      rejectedSuggestions,
      mostSuccessfulWorkflows,
      recentActions: list.slice(0, 25).map((a) => ({
        id: String(a.id),
        workflowId: String(a.workflow_id),
        actionType: String(a.action_type),
        status: String(a.status),
        confidence:
          a.confidence != null ? Number(a.confidence) : null,
        reasonEn: String(a.reason_en ?? ""),
        createdAt: String(a.created_at),
      })),
      pending: (approvals ?? []).map((p) => ({
        id: String(p.id),
        actionId: String(p.action_id),
        titleEn: String(p.title_en),
        bodyEn: String(p.body_en),
        createdAt: String(p.created_at),
      })),
    };
  } catch {
    return empty;
  }
}
