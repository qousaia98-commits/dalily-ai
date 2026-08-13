/**
 * Sprint 5 Phase 5 — reusable project checklists.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logProjectActivity } from "./activity";
import type { CollabChecklist } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export async function listChecklistTemplates(): Promise<
  Array<{ slug: string; titleEn: string; titleAr: string }>
> {
  try {
    const { data } = await db()
      .from("project_checklist_templates")
      .select("slug, title_en, title_ar")
      .order("slug");
    return (data ?? []).map((r: Record<string, unknown>) => ({
      slug: String(r.slug),
      titleEn: String(r.title_en),
      titleAr: String(r.title_ar),
    }));
  } catch {
    return [];
  }
}

export async function listProjectChecklists(
  projectId: string,
): Promise<CollabChecklist[]> {
  try {
    const { data: lists } = await db()
      .from("project_checklists")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!lists?.length) return [];

    const ids = lists.map((l: { id: string }) => l.id);
    const { data: items } = await db()
      .from("project_checklist_items")
      .select("*")
      .in("checklist_id", ids)
      .order("sort_order", { ascending: true });

    const byList = new Map<string, CollabChecklist["items"]>();
    for (const item of items ?? []) {
      const listId = String(item.checklist_id);
      const arr = byList.get(listId) ?? [];
      arr.push({
        id: String(item.id),
        title: String(item.title),
        sortOrder: Number(item.sort_order ?? 0),
        isDone: Boolean(item.is_done),
        doneAt: item.done_at ? String(item.done_at) : null,
      });
      byList.set(listId, arr);
    }

    return lists.map(
      (row: Record<string, unknown>): CollabChecklist => ({
        id: String(row.id),
        projectId: String(row.project_id),
        packageId: row.package_id ? String(row.package_id) : null,
        templateSlug: row.template_slug ? String(row.template_slug) : null,
        title: String(row.title),
        status: row.status as "open" | "completed",
        items: byList.get(String(row.id)) ?? [],
        createdAt: String(row.created_at),
      }),
    );
  } catch {
    return [];
  }
}

export async function createChecklistFromTemplate(input: {
  projectId: string;
  templateSlug: string;
  packageId?: string | null;
  createdBy?: string | null;
  locale?: string;
}): Promise<{ ok: true; checklist: CollabChecklist } | { ok: false; error: string }> {
  try {
    const { data: tmpl } = await db()
      .from("project_checklist_templates")
      .select("*")
      .eq("slug", input.templateSlug)
      .maybeSingle();

    if (!tmpl) return { ok: false, error: "template_not_found" };

    const isAr = input.locale === "ar";
    const title = isAr ? String(tmpl.title_ar) : String(tmpl.title_en);
    const rawItems = Array.isArray(tmpl.items) ? tmpl.items : [];

    const { data: list, error } = await db()
      .from("project_checklists")
      .insert({
        project_id: input.projectId,
        package_id: input.packageId ?? null,
        template_slug: input.templateSlug,
        title,
        created_by: input.createdBy ?? null,
      })
      .select("*")
      .single();

    if (error || !list) return { ok: false, error: error?.message ?? "insert_failed" };

    const itemRows = rawItems.map(
      (it: { title?: string }, i: number) => ({
        checklist_id: list.id,
        title: String(it?.title ?? `Item ${i + 1}`),
        sort_order: i,
      }),
    );

    if (itemRows.length > 0) {
      await db().from("project_checklist_items").insert(itemRows);
    }

    await logProjectActivity({
      projectId: input.projectId,
      packageId: input.packageId,
      eventKey: "checklist_created",
      labelEn: `Checklist added: ${title}`,
      labelAr: `تمت إضافة قائمة: ${title}`,
      actor: "customer",
      actorUserId: input.createdBy,
      payload: { checklistId: list.id, templateSlug: input.templateSlug },
    });

    const checklists = await listProjectChecklists(input.projectId);
    const checklist = checklists.find((c) => c.id === String(list.id));
    if (!checklist) return { ok: false, error: "reload_failed" };
    return { ok: true, checklist };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "create_failed" };
  }
}

export async function toggleChecklistItem(input: {
  projectId: string;
  checklistId: string;
  itemId: string;
  isDone: boolean;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db()
      .from("project_checklist_items")
      .update({
        is_done: input.isDone,
        done_at: input.isDone ? new Date().toISOString() : null,
        done_by: input.isDone ? (input.actorUserId ?? null) : null,
      })
      .eq("id", input.itemId)
      .eq("checklist_id", input.checklistId);

    if (error) return { ok: false, error: error.message };

    const { data: items } = await db()
      .from("project_checklist_items")
      .select("is_done")
      .eq("checklist_id", input.checklistId);

    const allDone =
      (items ?? []).length > 0 &&
      (items ?? []).every((i: { is_done: boolean }) => i.is_done);

    if (allDone) {
      await db()
        .from("project_checklists")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.checklistId)
        .eq("project_id", input.projectId);

      await logProjectActivity({
        projectId: input.projectId,
        eventKey: "checklist_completed",
        labelEn: "Checklist completed",
        labelAr: "اكتملت قائمة التحقق",
        actor: "customer",
        actorUserId: input.actorUserId,
        payload: { checklistId: input.checklistId },
      });
    } else {
      await db()
        .from("project_checklists")
        .update({
          status: "open",
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.checklistId)
        .eq("project_id", input.projectId);

      await logProjectActivity({
        projectId: input.projectId,
        eventKey: "checklist_item_toggled",
        labelEn: input.isDone ? "Checklist item completed" : "Checklist item reopened",
        labelAr: input.isDone ? "تم إكمال عنصر القائمة" : "أُعيد فتح عنصر القائمة",
        actor: "customer",
        actorUserId: input.actorUserId,
        payload: { checklistId: input.checklistId, itemId: input.itemId },
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "toggle_failed" };
  }
}
