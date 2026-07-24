/**
 * Official Dalily inbox messages — backed by marketplace_notifications.
 * One synthetic conversation id "dalily" is reused for all broadcasts.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BusinessNotification } from "@/lib/business/notification-inbox";

export const DALILY_CONVERSATION_ID = "dalily";

export const DALILY_MESSAGE_TYPES = [
  "dalily_message",
  "admin_broadcast", // legacy rows from Sprint 46
] as const;

export type DalilyMessageRow = {
  id: string;
  type: string;
  title_key: string;
  body_key: string;
  body_params: Record<string, string | number>;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Load Dalily chat messages for a user (broadcasts + official system chat).
 */
export async function listDalilyInboxMessages(
  userId: string,
): Promise<BusinessNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketplace_notifications")
    .select("id, type, title_key, body_key, body_params, href, read_at, created_at")
    .eq("user_id", userId)
    .in("type", [...DALILY_MESSAGE_TYPES])
    .order("created_at", { ascending: true })
    .limit(200);

  return (data ?? []).map((row) => mapRowToInboxItem(row as DalilyMessageRow));
}

function mapRowToInboxItem(row: DalilyMessageRow): BusinessNotification {
  const params = (row.body_params ?? {}) as Record<string, string | number>;
  const title = typeof params.title === "string" ? params.title.trim() : "";
  const body = typeof params.body === "string" ? params.body.trim() : "";
  const bodyText =
    title && body ? `${title}\n\n${body}` : title || body || undefined;

  return {
    id: `dalily_msg_${row.id}`,
    source: "dalily",
    icon: "message",
    titleKey: "dalilyOfficial.title",
    bodyKey: "dalilyOfficial.body",
    bodyParams: { title, body },
    bodyText,
    createdAt: row.created_at,
    unread: !row.read_at,
    href: row.href ?? undefined,
  };
}

/**
 * Mark all Dalily inbox notifications as read for this user.
 * Returns broadcastIds referenced by the rows that were marked.
 */
export async function markDalilyMessagesRead(userId: string): Promise<{
  marked: number;
  broadcastIds: string[];
}> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("marketplace_notifications")
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("type", [...DALILY_MESSAGE_TYPES])
    .select("id, body_params");

  if (error || !data) return { marked: 0, broadcastIds: [] };

  const broadcastIds = [
    ...new Set(
      data
        .map((row) => {
          const params = (row.body_params ?? {}) as Record<string, unknown>;
          return typeof params.broadcastId === "string" ? params.broadcastId : null;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  return { marked: data.length, broadcastIds };
}

/**
 * Resolve which recipients use business vs customer inbox hrefs.
 */
export async function resolveDalilyInboxHrefs(
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const admin = createAdminClient();
  const businessIds = new Set<string>();

  // Chunk to avoid oversized .in() filters
  const chunkSize = 500;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "business")
      .is("revoked_at", null)
      .in("user_id", chunk);
    for (const r of roles ?? []) businessIds.add(r.user_id);

    const { data: owners } = await admin
      .from("providers")
      .select("owner_id")
      .is("deleted_at", null)
      .in("owner_id", chunk);
    for (const r of owners ?? []) {
      if (r.owner_id) businessIds.add(r.owner_id);
    }
  }

  for (const id of userIds) {
    map.set(
      id,
      businessIds.has(id) ? "/business/messages/dalily" : "/messages/dalily",
    );
  }
  return map;
}
