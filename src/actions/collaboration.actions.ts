"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isCollaborationWorkspaceEnabled,
  isMultiServiceProjectsEnabled,
} from "@/lib/config/feature-flags";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { generateProjectAiSummary } from "@/lib/ai/project-assistant";
import {
  createChecklistFromTemplate,
  createProjectTask,
  decideProjectApproval,
  getCollaborationWorkspace,
  requestProjectApproval,
  toggleChecklistItem,
  updateProjectTask,
  type CollabApprovalKind,
  type CollabTaskPriority,
  type CollabTaskStatus,
  type CollaborationWorkspace,
  type CollabAiSummary,
} from "@/lib/collaboration";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

export type CollabActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function assertProjectAccess(projectId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: project } = await admin
    .from("service_projects")
    .select("id, customer_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false as const, error: "not_found" as const };
  if (project.customer_id === userId) {
    return { ok: true as const, role: "customer" as const };
  }
  const { data: packages } = await admin
    .from("project_packages")
    .select("assigned_provider_id")
    .eq("project_id", projectId);
  const providerIds = (packages ?? [])
    .map((p: { assigned_provider_id: string | null }) => p.assigned_provider_id)
    .filter(Boolean) as string[];
  if (providerIds.length > 0) {
    const { data: providers } = await admin
      .from("providers")
      .select("id, owner_id")
      .in("id", providerIds);
    if ((providers ?? []).some((p: { owner_id: string }) => p.owner_id === userId)) {
      return { ok: true as const, role: "provider" as const };
    }
  }
  return { ok: false as const, error: "forbidden" as const };
}

function featureOn() {
  return isMultiServiceProjectsEnabled() && isCollaborationWorkspaceEnabled();
}

function revalidateProject(projectId: string) {
  revalidatePath(`/account/projects/${projectId}`);
}

export async function loadCollaborationWorkspaceAction(
  projectId: string,
): Promise<
  | { ok: true; workspace: CollaborationWorkspace }
  | { ok: false; error: string }
> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };

  const workspace = await getCollaborationWorkspace(projectId);
  if (!workspace) return { ok: false, error: "not_found" };

  void emitAiLearningEvent({
    eventType: "collab_workspace_opened",
    customerId: access.role === "customer" ? user.id : null,
    metadata: { projectId, anonymized: true },
  });

  return { ok: true, workspace };
}

export async function createCollabTaskAction(input: {
  projectId: string;
  title: string;
  description?: string;
  priority?: CollabTaskPriority;
  dueAt?: string | null;
  packageId?: string | null;
}): Promise<CollabActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(input.projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };

  const result = await createProjectTask({
    ...input,
    createdBy: user.id,
  });
  if (!result.ok) return result;

  void emitAiLearningEvent({
    eventType: "collab_task_created",
    customerId: access.role === "customer" ? user.id : null,
    metadata: { projectId: input.projectId, anonymized: true },
  });
  revalidateProject(input.projectId);
  return { ok: true };
}

export async function updateCollabTaskAction(input: {
  projectId: string;
  taskId: string;
  status?: CollabTaskStatus;
  priority?: CollabTaskPriority;
  title?: string;
  dueAt?: string | null;
}): Promise<CollabActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(input.projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };

  const result = await updateProjectTask({
    ...input,
    actorUserId: user.id,
  });
  if (!result.ok) return result;

  void emitAiLearningEvent({
    eventType:
      input.status === "completed"
        ? "collab_task_completed"
        : "collab_task_updated",
    customerId: access.role === "customer" ? user.id : null,
    metadata: { projectId: input.projectId, anonymized: true },
  });
  revalidateProject(input.projectId);
  return { ok: true };
}

export async function createCollabChecklistAction(input: {
  projectId: string;
  templateSlug: string;
  packageId?: string | null;
  locale?: string;
}): Promise<CollabActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(input.projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };

  const result = await createChecklistFromTemplate({
    ...input,
    createdBy: user.id,
  });
  if (!result.ok) return result;

  void emitAiLearningEvent({
    eventType: "collab_checklist_created",
    customerId: access.role === "customer" ? user.id : null,
    metadata: {
      projectId: input.projectId,
      templateSlug: input.templateSlug,
      anonymized: true,
    },
  });
  revalidateProject(input.projectId);
  return { ok: true };
}

export async function toggleCollabChecklistItemAction(input: {
  projectId: string;
  checklistId: string;
  itemId: string;
  isDone: boolean;
}): Promise<CollabActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(input.projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };

  const result = await toggleChecklistItem({
    ...input,
    actorUserId: user.id,
  });
  if (!result.ok) return result;

  void emitAiLearningEvent({
    eventType: input.isDone
      ? "collab_checklist_item_toggled"
      : "collab_checklist_item_toggled",
    customerId: access.role === "customer" ? user.id : null,
    metadata: { projectId: input.projectId, anonymized: true },
  });
  revalidateProject(input.projectId);
  return { ok: true };
}

export async function requestCollabApprovalAction(input: {
  projectId: string;
  kind: CollabApprovalKind;
  title: string;
  description?: string;
  packageId?: string | null;
}): Promise<CollabActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(input.projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };

  const result = await requestProjectApproval({
    ...input,
    requestedBy: user.id,
  });
  if (!result.ok) return result;

  void emitAiLearningEvent({
    eventType: "collab_approval_requested",
    customerId: access.role === "customer" ? user.id : null,
    metadata: { projectId: input.projectId, kind: input.kind, anonymized: true },
  });
  revalidateProject(input.projectId);
  return { ok: true };
}

export async function decideCollabApprovalAction(input: {
  projectId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<CollabActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(input.projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };
  // Only the project customer (or platform admin via separate path) may decide.
  if (access.role !== "customer") {
    return { ok: false, error: "customer_only" };
  }

  const result = await decideProjectApproval({
    ...input,
    decidedBy: user.id,
  });
  if (!result.ok) return result;

  void emitAiLearningEvent({
    eventType:
      input.decision === "approved"
        ? "collab_approval_accepted"
        : "collab_approval_rejected",
    customerId: access.role === "customer" ? user.id : null,
    metadata: { projectId: input.projectId, anonymized: true },
  });
  revalidateProject(input.projectId);
  return { ok: true };
}

export async function generateCollabAiSummaryAction(input: {
  projectId: string;
  locale?: string;
}): Promise<
  | { ok: true; result: CollabAiSummary }
  | { ok: false; error: string }
> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(input.projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };

  const rate = checkRateLimit(rateLimitKey("collab_ai", user.id), {
    max: 15,
    windowMs: 60_000,
  });
  if (!rate.ok) return { ok: false, error: "rate_limited" };

  const result = await generateProjectAiSummary(input);
  if (!result.ok) return result;

  void emitAiLearningEvent({
    eventType: "collab_ai_summary_generated",
    customerId: access.role === "customer" ? user.id : null,
    metadata: { projectId: input.projectId, anonymized: true },
  });
  return result;
}

export async function acceptCollabAiRecommendationAction(input: {
  projectId: string;
  recommendation: string;
}): Promise<CollabActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const access = await assertProjectAccess(input.projectId, user.id);
  if (!access.ok) return { ok: false, error: access.error };

  // AI never mutates project data — acceptance is learning-only.
  void emitAiLearningEvent({
    eventType: "collab_ai_recommendation_accepted",
    customerId: access.role === "customer" ? user.id : null,
    metadata: {
      projectId: input.projectId,
      recommendationHash: input.recommendation.slice(0, 80),
      anonymized: true,
    },
  });
  return { ok: true };
}
