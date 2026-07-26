/**
 * Sprint 5 Phase 6 — AI notification digests.
 * Summarizes only notifications the user already owns.
 */

import { chatAiComplete, parseJsonObject } from "@/lib/ai/chat/llm";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSmartNotifications } from "./center";
import type { NotifDigestKind, NotificationDigest } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function mapDigest(row: Record<string, unknown>): NotificationDigest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    digestKind: row.digest_kind as NotifDigestKind,
    summaryEn: String(row.summary_en),
    summaryAr: String(row.summary_ar),
    highlights: Array.isArray(row.highlights)
      ? row.highlights.map(String)
      : [],
    notificationIds: Array.isArray(row.notification_ids)
      ? row.notification_ids.map(String)
      : [],
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  };
}

function heuristicDigest(
  kind: NotifDigestKind,
  locale: string,
  items: Awaited<ReturnType<typeof listSmartNotifications>>,
): { summaryEn: string; summaryAr: string; highlights: string[] } {
  const unread = items.filter((n) => n.status === "unread" && !n.isGroupSummary);
  const critical = unread.filter(
    (n) => (n.aiSuggestedPriority ?? n.priority) === "critical",
  ).length;
  const high = unread.filter(
    (n) => (n.aiSuggestedPriority ?? n.priority) === "high",
  ).length;

  const summaryEn = `${kind} digest: ${unread.length} unread · ${critical} critical · ${high} high priority.`;
  const summaryAr = `ملخص ${kind}: ${unread.length} غير مقروء · ${critical} حرج · ${high} أولوية عالية.`;

  const highlights = unread.slice(0, 5).map((n) =>
    locale === "ar" ? n.titleAr : n.titleEn,
  );

  return { summaryEn, summaryAr, highlights };
}

/**
 * Generate a digest from the user's own notification history only.
 * AI never changes notification priority or business data.
 */
export async function generateNotificationDigest(input: {
  userId: string;
  kind: NotifDigestKind;
  locale?: string;
}): Promise<
  { ok: true; digest: NotificationDigest } | { ok: false; error: string }
> {
  const locale = input.locale === "ar" ? "ar" : "en";
  const status = input.kind === "unread" ? "unread" : "all";
  const items = await listSmartNotifications({
    userId: input.userId,
    status,
    limit: 60,
  });

  const visible = items.filter((n) => n.status !== "deleted");
  const fallback = heuristicDigest(input.kind, locale, visible);

  const context = visible.slice(0, 40).map((n) => ({
    category: n.category,
    priority: n.aiSuggestedPriority ?? n.priority,
    title: locale === "ar" ? n.titleAr : n.titleEn,
    status: n.status,
  }));

  const raw = await chatAiComplete({
    temperature: 0.2,
    system: `You summarize a user's Dalily notifications they already have access to.
Language: ${locale === "ar" ? "Arabic" : "English"}.
Return ONLY JSON: {"summaryEn":"...","summaryAr":"...","highlights":["..."]}
Never invent events. Never claim you changed data.`,
    user: JSON.stringify({ kind: input.kind, notifications: context }),
  });

  const parsed = parseJsonObject<{
    summaryEn?: string;
    summaryAr?: string;
    highlights?: string[];
  }>(raw);

  const summaryEn = parsed?.summaryEn?.trim() || fallback.summaryEn;
  const summaryAr = parsed?.summaryAr?.trim() || fallback.summaryAr;
  const highlights = Array.isArray(parsed?.highlights)
    ? parsed!.highlights!.map(String).slice(0, 8)
    : fallback.highlights;

  try {
    const { data, error } = await db()
      .from("notification_digests")
      .insert({
        user_id: input.userId,
        digest_kind: input.kind,
        summary_en: summaryEn,
        summary_ar: summaryAr,
        highlights,
        notification_ids: visible.map((n) => n.id).slice(0, 40),
      })
      .select("*")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "insert_failed" };
    }
    return { ok: true, digest: mapDigest(data) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "digest_failed",
    };
  }
}

export async function listNotificationDigests(
  userId: string,
  limit = 10,
): Promise<NotificationDigest[]> {
  try {
    const { data } = await db()
      .from("notification_digests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map(mapDigest);
  } catch {
    return [];
  }
}

export async function markDigestOpened(
  userId: string,
  digestId: string,
): Promise<void> {
  try {
    await db()
      .from("notification_digests")
      .update({ read_at: new Date().toISOString() })
      .eq("id", digestId)
      .eq("user_id", userId);
  } catch {
    // soft
  }
}
