/**
 * Sprint 5 Phase 6 — smart notification center repository.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { deliverSmartNotificationChannels } from "./channels";
import { buildGroupKey, groupedTitle } from "./grouping";
import {
  getNotificationPreferences,
  isCategoryEnabled,
} from "./preferences";
import { resolveBasePriority, suggestAiPriority } from "./priority";
import type {
  CreateSmartNotificationInput,
  NotifCategory,
  NotifStatus,
  SmartNotification,
} from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapRow(row: Record<string, unknown>): SmartNotification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    category: row.category as NotifCategory,
    eventKey: String(row.event_key),
    priority: row.priority as SmartNotification["priority"],
    aiSuggestedPriority: (row.ai_suggested_priority as SmartNotification["priority"]) ?? null,
    titleEn: String(row.title_en),
    titleAr: String(row.title_ar),
    bodyEn: String(row.body_en),
    bodyAr: String(row.body_ar),
    href: row.href ? String(row.href) : null,
    actionKey: (row.action_key as SmartNotification["actionKey"]) ?? null,
    actionLabelEn: row.action_label_en ? String(row.action_label_en) : null,
    actionLabelAr: row.action_label_ar ? String(row.action_label_ar) : null,
    actionPayload: (row.action_payload as Record<string, unknown>) ?? {},
    groupKey: row.group_key ? String(row.group_key) : null,
    groupId: row.group_id ? String(row.group_id) : null,
    isGroupSummary: Boolean(row.is_group_summary),
    groupCount: Number(row.group_count ?? 1),
    status: row.status as NotifStatus,
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export async function createSmartNotification(
  input: CreateSmartNotificationInput,
): Promise<{ ok: true; notification: SmartNotification } | { ok: false; error: string }> {
  try {
    const prefs = await getNotificationPreferences(input.userId);
    if (!isCategoryEnabled(prefs, input.category) && input.category !== "emergency") {
      return { ok: false, error: "category_disabled" };
    }

    const basePriority =
      input.priority ??
      resolveBasePriority({
        category: input.category,
        eventKey: input.eventKey,
      });

    const groupKey =
      input.groupKey ??
      buildGroupKey({
        category: input.category,
        eventKey: input.eventKey,
        conversationId:
          typeof input.metadata?.conversationId === "string"
            ? input.metadata.conversationId
            : null,
        projectId:
          typeof input.metadata?.projectId === "string"
            ? input.metadata.projectId
            : null,
      });

    let unreadSameGroup = 0;
    if (groupKey) {
      const { count } = await db()
        .from("smart_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId)
        .eq("group_key", groupKey)
        .eq("status", "unread")
        .eq("is_group_summary", false);
      unreadSameGroup = count ?? 0;
    }

    const aiSuggested = suggestAiPriority({
      category: input.category,
      eventKey: input.eventKey,
      basePriority,
      unreadSameGroup,
    });

    const { data, error } = await db()
      .from("smart_notifications")
      .insert({
        user_id: input.userId,
        category: input.category,
        event_key: input.eventKey,
        priority: basePriority,
        ai_suggested_priority:
          aiSuggested !== basePriority ? aiSuggested : null,
        title_en: input.titleEn,
        title_ar: input.titleAr,
        body_en: input.bodyEn,
        body_ar: input.bodyAr,
        href: input.href ?? null,
        action_key: input.actionKey ?? "open",
        action_label_en: input.actionLabelEn ?? "Open",
        action_label_ar: input.actionLabelAr ?? "فتح",
        action_payload: input.actionPayload ?? {},
        group_key: groupKey,
        source_table: input.sourceTable ?? null,
        source_id: input.sourceId ?? null,
        marketplace_notification_id: input.marketplaceNotificationId ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "insert_failed" };
    }

    const notification = mapRow(data);

    if (aiSuggested !== basePriority) {
      void emitAiLearningEvent({
        eventType: "notif_priority_boost_suggested",
        customerId: input.userId,
        metadata: {
          anonymized: true,
          base: basePriority,
          suggested: aiSuggested,
          category: input.category,
        },
      });
    }

    // Refresh / create group summary when 2+ unread in same group
    if (groupKey && unreadSameGroup + 1 >= 2) {
      await upsertGroupSummary({
        userId: input.userId,
        groupKey,
        category: input.category,
        eventKey: input.eventKey,
        count: unreadSameGroup + 1,
        href: input.href ?? null,
        priority: basePriority,
      });
    }

    await deliverSmartNotificationChannels(notification, {
      forceInAppOnly: input.forceInAppOnly,
    });

    return { ok: true, notification };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "create_failed",
    };
  }
}

async function upsertGroupSummary(input: {
  userId: string;
  groupKey: string;
  category: NotifCategory;
  eventKey: string;
  count: number;
  href: string | null;
  priority: SmartNotification["priority"];
}) {
  const titles = groupedTitle(input.category, input.count, "en");
  try {
    const { data: existing } = await db()
      .from("smart_notifications")
      .select("id")
      .eq("user_id", input.userId)
      .eq("group_key", input.groupKey)
      .eq("is_group_summary", true)
      .eq("status", "unread")
      .maybeSingle();

    if (existing?.id) {
      await db()
        .from("smart_notifications")
        .update({
          group_count: input.count,
          title_en: titles.en,
          title_ar: titles.ar,
          body_en: titles.en,
          body_ar: titles.ar,
          updated_at: new Date().toISOString(),
          priority: input.priority,
        })
        .eq("id", existing.id);
      return;
    }

    await db().from("smart_notifications").insert({
      user_id: input.userId,
      category: input.category,
      event_key: `${input.eventKey}_grouped`,
      priority: input.priority,
      title_en: titles.en,
      title_ar: titles.ar,
      body_en: titles.en,
      body_ar: titles.ar,
      href: input.href,
      action_key: "open",
      action_label_en: "Open",
      action_label_ar: "فتح",
      group_key: input.groupKey,
      is_group_summary: true,
      group_count: input.count,
      metadata: { grouped: true },
    });

    void emitAiLearningEvent({
      eventType: "notif_grouped",
      customerId: input.userId,
      metadata: {
        anonymized: true,
        groupKey: input.groupKey,
        count: input.count,
        category: input.category,
      },
    });
  } catch {
    // soft
  }
}

export async function listSmartNotifications(input: {
  userId: string;
  status?: NotifStatus | "all";
  category?: NotifCategory;
  query?: string;
  limit?: number;
}): Promise<SmartNotification[]> {
  try {
    let q = db()
      .from("smart_notifications")
      .select("*")
      .eq("user_id", input.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 80);

    if (input.status && input.status !== "all") {
      q = q.eq("status", input.status);
    } else {
      q = q.neq("status", "deleted");
    }
    if (input.category) q = q.eq("category", input.category);

    const { data } = await q;
    let rows: SmartNotification[] = (data ?? []).map(
      (row: Record<string, unknown>) => mapRow(row),
    );

    if (input.query?.trim()) {
      const needle = input.query.trim().toLowerCase();
      rows = rows.filter(
        (n) =>
          n.titleEn.toLowerCase().includes(needle) ||
          n.titleAr.includes(needle) ||
          n.bodyEn.toLowerCase().includes(needle) ||
          n.bodyAr.includes(needle),
      );
    }
    return rows;
  } catch {
    return [];
  }
}

export async function countUnreadSmartNotifications(
  userId: string,
): Promise<number> {
  try {
    const { count } = await db()
      .from("smart_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "unread")
      .eq("is_group_summary", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function updateSmartNotificationStatus(input: {
  userId: string;
  notificationId: string;
  status: NotifStatus;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.status === "read") patch.read_at = new Date().toISOString();
  if (input.status === "archived")
    patch.archived_at = new Date().toISOString();
  if (input.status === "deleted") {
    patch.deleted_at = new Date().toISOString();
  }
  if (input.status === "unread") {
    patch.read_at = null;
  }

  try {
    const { error } = await db()
      .from("smart_notifications")
      .update(patch)
      .eq("id", input.notificationId)
      .eq("user_id", input.userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "update_failed",
    };
  }
}

export async function markAllSmartNotificationsRead(
  userId: string,
): Promise<void> {
  try {
    await db()
      .from("smart_notifications")
      .update({
        status: "read",
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "unread");
  } catch {
    // soft
  }
}

/**
 * Infer smart category from legacy marketplace notification type.
 */
export function categoryFromMarketplaceType(type: string): NotifCategory {
  const t = type.toLowerCase();
  if (t.includes("emergency")) return "emergency";
  if (t.includes("chat") || t.includes("message")) return "messages";
  if (t.includes("voice")) return "voice";
  if (t.includes("payment") || t.includes("unlock")) return "payments";
  if (t.includes("invoice")) return "invoices";
  if (t.includes("booking") || t.includes("appointment")) return "bookings";
  if (t.includes("project") || t.includes("approval") || t.includes("task"))
    return t.includes("approval")
      ? "approvals"
      : t.includes("task")
        ? "tasks"
        : "projects";
  if (t.includes("recurring") || t.includes("maintenance")) return "recurring";
  if (t.includes("admin") || t.includes("verification") || t.includes("dalily"))
    return "admin";
  return "marketplace";
}
