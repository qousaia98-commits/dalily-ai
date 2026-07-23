/**
 * Admin broadcasts — history + delivery via marketplace notifications.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type BroadcastTarget = "all" | "providers" | "customers" | "single";

export type AdminBroadcastItem = {
  id: string;
  title: string;
  body: string;
  target: BroadcastTarget;
  targetUserId: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  deliveryCount: number;
  createdAt: string;
};

export async function listAdminBroadcasts(limit = 30): Promise<AdminBroadcastItem[]> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("admin_broadcasts")
    .select(
      "id, title, body, target, target_user_id, status, scheduled_at, sent_at, delivery_count, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    target: row.target as BroadcastTarget,
    targetUserId: (row.target_user_id as string) ?? null,
    status: row.status as string,
    scheduledAt: (row.scheduled_at as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
    deliveryCount: Number(row.delivery_count) || 0,
    createdAt: row.created_at as string,
  }));
}

export async function resolveBroadcastRecipients(
  target: BroadcastTarget,
  targetUserId?: string | null,
): Promise<string[]> {
  const admin = createAdminClient();

  if (target === "single") {
    return targetUserId ? [targetUserId] : [];
  }

  if (target === "providers") {
    const { data } = await admin
      .from("providers")
      .select("owner_id")
      .is("deleted_at", null)
      .in("status", ["active", "pending_review", "changes_requested"]);
    return [...new Set((data ?? []).map((r) => r.owner_id).filter(Boolean))];
  }

  if (target === "customers") {
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "user")
      .is("revoked_at", null)
      .limit(5000);
    const { data: business } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "business")
      .is("revoked_at", null)
      .limit(5000);
    const businessIds = new Set((business ?? []).map((r) => r.user_id));
    return [...new Set((roles ?? []).map((r) => r.user_id).filter((id) => !businessIds.has(id)))];
  }

  // all
  const { data } = await admin.from("users").select("id").is("deleted_at", null).limit(5000);
  return (data ?? []).map((r) => r.id);
}
