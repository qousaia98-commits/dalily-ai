/**
 * Sprint 5 Phase 5 — AI Project Assistant.
 * Read-only suggestions; never mutates project data.
 */

import { chatAiComplete, parseJsonObject } from "@/lib/ai/chat/llm";
import { getProjectDashboard } from "@/lib/projects/queries";
import { getCollaborationWorkspace } from "@/lib/collaboration/workspace";
import type { CollabAiSummary } from "@/lib/collaboration/types";

function heuristicSummary(
  locale: string,
  workspace: NonNullable<Awaited<ReturnType<typeof getCollaborationWorkspace>>>,
  dashboard: NonNullable<Awaited<ReturnType<typeof getProjectDashboard>>>,
): CollabAiSummary {
  const isAr = locale === "ar";
  const p = workspace.progress;

  const summary = isAr
    ? `تقدم المشروع حوالي ${p.overallPct}٪. مكتمل ${p.packagesCompleted} من ${p.packagesTotal} حزم. مهام مفتوحة: ${p.tasksOpen}، متأخرة: ${p.tasksOverdue}، موافقات معلّقة: ${p.approvalsPending}.`
    : `Project progress is about ${p.overallPct}%. ${p.packagesCompleted}/${p.packagesTotal} packages done. Open tasks: ${p.tasksOpen}, overdue: ${p.tasksOverdue}, pending approvals: ${p.approvalsPending}.`;

  const nextSteps: string[] = [];
  const risks: string[] = [];
  const missingDocuments: string[] = [];

  if (p.approvalsPending > 0) {
    nextSteps.push(
      isAr
        ? "راجع طلبات الموافقة المعلّقة واتخذ قراراً."
        : "Review pending approval requests and decide.",
    );
  }
  if (p.tasksOverdue > 0) {
    risks.push(
      isAr
        ? `${p.tasksOverdue} مهام متأخرة تحتاج إعادة جدولة.`
        : `${p.tasksOverdue} overdue tasks need rescheduling.`,
    );
    nextSteps.push(
      isAr
        ? "حدّث تواريخ الاستحقاق أو أكمل المهام المتأخرة."
        : "Update due dates or finish overdue tasks.",
    );
  }
  if (p.tasksBlocked > 0 || p.blockedPackages > 0) {
    risks.push(
      isAr
        ? "يوجد عمل محظور — تحقق من التبعيات والحزم."
        : "Blocked work detected — check dependencies and packages.",
    );
  }
  if (p.checklistsOpen > 0) {
    nextSteps.push(
      isAr
        ? "أكمل عناصر قوائم التحقق المفتوحة."
        : "Complete open checklist items.",
    );
  }

  for (const need of ["invoice", "contract", "guarantee"] as const) {
    const has = dashboard.documents.some(
      (d) =>
        d.kind === need ||
        (d.fileName ?? "").toLowerCase().includes(need),
    );
    if (!has) {
      missingDocuments.push(
        isAr
          ? need === "invoice"
            ? "فاتورة"
            : need === "contract"
              ? "عقد"
              : "ضمان"
          : need,
      );
    }
  }

  for (const hint of dashboard.coordinationHints.slice(0, 3)) {
    nextSteps.push(isAr ? hint.messageAr : hint.messageEn);
  }

  if (nextSteps.length === 0) {
    nextSteps.push(
      isAr
        ? "استمر في التقدم الحالي وحدّث الصور والمستندات."
        : "Keep current progress and update photos/documents.",
    );
  }

  return {
    summary,
    nextSteps: nextSteps.slice(0, 5),
    risks: risks.slice(0, 4),
    missingDocuments: missingDocuments.slice(0, 5),
    aiGenerated: true,
  };
}

/**
 * Summarize project progress and suggest next steps.
 * Never writes to project tables.
 */
export async function generateProjectAiSummary(input: {
  projectId: string;
  locale?: string;
}): Promise<
  { ok: true; result: CollabAiSummary } | { ok: false; error: string }
> {
  const locale = input.locale === "ar" ? "ar" : "en";
  const [workspace, dashboard] = await Promise.all([
    getCollaborationWorkspace(input.projectId),
    getProjectDashboard(input.projectId, { refresh: false }),
  ]);

  if (!workspace || !dashboard) {
    return { ok: false, error: "project_not_found" };
  }

  const fallback = heuristicSummary(locale, workspace, dashboard);

  const context = {
    title: dashboard.title,
    status: dashboard.status,
    completionPct: dashboard.completionPct,
    progress: workspace.progress,
    packages: dashboard.packages.map((p) => ({
      trade: p.tradeSlug,
      status: p.status,
      delayHours: p.delayHours,
    })),
    tasks: workspace.tasks.slice(0, 20).map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt,
    })),
    approvals: workspace.approvals
      .filter((a) => a.status === "pending")
      .map((a) => ({ title: a.title, kind: a.kind })),
    documents: dashboard.documents.slice(0, 15).map((d) => ({
      kind: d.kind,
      fileName: d.fileName,
    })),
    hints: dashboard.coordinationHints,
  };

  const raw = await chatAiComplete({
    temperature: 0.2,
    system: `You are a project collaboration assistant for a home-services marketplace in Syria.
Language: ${locale === "ar" ? "Arabic" : "English"}.
Return ONLY valid JSON:
{"summary":"string","nextSteps":["..."],"risks":["..."],"missingDocuments":["..."]}
Rules: Never claim you changed project data. Be concrete and actionable.`,
    user: JSON.stringify(context),
  });

  const parsed = parseJsonObject<{
    summary?: string;
    nextSteps?: string[];
    risks?: string[];
    missingDocuments?: string[];
  }>(raw);

  if (!parsed) return { ok: true, result: fallback };

  return {
    ok: true,
    result: {
      summary: parsed.summary?.trim() || fallback.summary,
      nextSteps: Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps.map(String).slice(0, 6)
        : fallback.nextSteps,
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.map(String).slice(0, 5)
        : fallback.risks,
      missingDocuments: Array.isArray(parsed.missingDocuments)
        ? parsed.missingDocuments.map(String).slice(0, 5)
        : fallback.missingDocuments,
      aiGenerated: true,
    },
  };
}
