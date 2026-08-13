/**
 * Sprint 5 Phase 5 — shared project tasks.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logProjectActivity } from "./activity";
import type { CollabTask, CollabTaskPriority, CollabTaskStatus } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapTask(row: Record<string, unknown>): CollabTask {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    packageId: row.package_id ? String(row.package_id) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    status: row.status as CollabTaskStatus,
    priority: row.priority as CollabTaskPriority,
    dueAt: row.due_at ? String(row.due_at) : null,
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    assignedRole: (row.assigned_role as CollabTask["assignedRole"]) ?? null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
  };
}

export async function listProjectTasks(projectId: string): Promise<CollabTask[]> {
  try {
    const { data } = await db()
      .from("project_tasks")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    return (data ?? []).map(mapTask);
  } catch {
    return [];
  }
}

export async function createProjectTask(input: {
  projectId: string;
  title: string;
  description?: string | null;
  priority?: CollabTaskPriority;
  dueAt?: string | null;
  packageId?: string | null;
  assignedUserId?: string | null;
  assignedRole?: CollabTask["assignedRole"];
  createdBy?: string | null;
}): Promise<{ ok: true; task: CollabTask } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "empty_title" };

  try {
    const { data, error } = await db()
      .from("project_tasks")
      .insert({
        project_id: input.projectId,
        package_id: input.packageId ?? null,
        title,
        description: input.description?.trim() || null,
        priority: input.priority ?? "normal",
        due_at: input.dueAt ?? null,
        assigned_user_id: input.assignedUserId ?? null,
        assigned_role: input.assignedRole ?? null,
        created_by: input.createdBy ?? null,
      })
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };

    const task = mapTask(data);
    await logProjectActivity({
      projectId: input.projectId,
      packageId: input.packageId,
      eventKey: "task_created",
      labelEn: `Task created: ${title}`,
      labelAr: `تم إنشاء مهمة: ${title}`,
      actor: "customer",
      actorUserId: input.createdBy,
      payload: { taskId: task.id },
    });

    return { ok: true, task };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "create_failed" };
  }
}

export async function updateProjectTask(input: {
  taskId: string;
  projectId: string;
  status?: CollabTaskStatus;
  priority?: CollabTaskPriority;
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  assignedUserId?: string | null;
  packageId?: string | null;
  actorUserId?: string | null;
}): Promise<{ ok: true; task: CollabTask } | { ok: false; error: string }> {
  try {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "completed") {
        patch.completed_at = new Date().toISOString();
        patch.completed_by = input.actorUserId ?? null;
      } else {
        patch.completed_at = null;
        patch.completed_by = null;
      }
    }
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.dueAt !== undefined) patch.due_at = input.dueAt;
    if (input.assignedUserId !== undefined) patch.assigned_user_id = input.assignedUserId;
    if (input.packageId !== undefined) patch.package_id = input.packageId;

    const { data, error } = await db()
      .from("project_tasks")
      .update(patch)
      .eq("id", input.taskId)
      .eq("project_id", input.projectId)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "update_failed" };

    const task = mapTask(data);
    if (input.status === "completed") {
      await logProjectActivity({
        projectId: input.projectId,
        packageId: task.packageId,
        eventKey: "task_completed",
        labelEn: `Task completed: ${task.title}`,
        labelAr: `اكتملت المهمة: ${task.title}`,
        actor: "customer",
        actorUserId: input.actorUserId,
        payload: { taskId: task.id },
      });
    } else {
      await logProjectActivity({
        projectId: input.projectId,
        packageId: task.packageId,
        eventKey: "task_updated",
        labelEn: `Task updated: ${task.title}`,
        labelAr: `تم تحديث المهمة: ${task.title}`,
        actor: "customer",
        actorUserId: input.actorUserId,
        payload: { taskId: task.id, status: task.status },
      });
    }

    return { ok: true, task };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "update_failed" };
  }
}
