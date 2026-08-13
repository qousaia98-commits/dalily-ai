/**
 * Sprint 5 Phase 5 — collaboration workspace aggregate loader.
 */

import { getProjectDashboard } from "@/lib/projects/queries";
import { listProjectActivity } from "./activity";
import { listProjectApprovals } from "./approvals";
import { listChecklistTemplates, listProjectChecklists } from "./checklists";
import { listProjectTasks } from "./tasks";
import type { CollaborationWorkspace, CollabProgress } from "./types";

export async function getCollaborationWorkspace(
  projectId: string,
): Promise<CollaborationWorkspace | null> {
  const dashboard = await getProjectDashboard(projectId, { refresh: false });
  if (!dashboard) return null;

  const [tasks, checklists, approvals, activity, templates] = await Promise.all([
    listProjectTasks(projectId),
    listProjectChecklists(projectId),
    listProjectApprovals(projectId),
    listProjectActivity(projectId),
    listChecklistTemplates(),
  ]);

  const now = Date.now();
  const tasksOpen = tasks.filter((t) => t.status !== "completed").length;
  const tasksBlocked = tasks.filter((t) => t.status === "blocked").length;
  const tasksOverdue = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.dueAt &&
      new Date(t.dueAt).getTime() < now,
  ).length;

  const packagesCompleted = dashboard.packages.filter(
    (p) => p.status === "completed",
  ).length;
  const packagesTotal = dashboard.packages.length;
  const delayedPackages = dashboard.packages.filter(
    (p) => (p.delayHours ?? 0) > 0 && p.status !== "completed",
  ).length;
  const blockedPackages = dashboard.packages.filter(
    (p) => p.status === "blocked",
  ).length;

  const taskPct =
    tasks.length === 0
      ? dashboard.completionPct
      : Math.round(
          (tasks.filter((t) => t.status === "completed").length / tasks.length) *
            100,
        );
  const packagePct =
    packagesTotal === 0
      ? 0
      : Math.round((packagesCompleted / packagesTotal) * 100);
  const overallPct = Math.round((dashboard.completionPct + taskPct + packagePct) / 3);

  const progress: CollabProgress = {
    overallPct: Math.min(100, Math.max(0, overallPct)),
    packagesCompleted,
    packagesTotal,
    tasksOpen,
    tasksBlocked,
    tasksOverdue,
    approvalsPending: approvals.filter((a) => a.status === "pending").length,
    checklistsOpen: checklists.filter((c) => c.status === "open").length,
    delayedPackages,
    blockedPackages,
  };

  return {
    projectId,
    progress,
    tasks,
    checklists,
    approvals,
    activity,
    templates,
  };
}
