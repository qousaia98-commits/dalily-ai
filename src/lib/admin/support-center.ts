/**
 * Support Center — generic "contact platform admin" inbox (read + status updates).
 * Distinct from booking_issue_reports, which requires an actual booking.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type SupportMessageStatus = "open" | "in_progress" | "resolved" | "closed";

export type AdminSupportMessageItem = {
  id: string;
  userId: string;
  role: string;
  subject: string;
  message: string;
  status: SupportMessageStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export async function listSupportMessages(params?: {
  status?: SupportMessageStatus | "all";
  limit?: number;
}): Promise<AdminSupportMessageItem[]> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from("support_messages")
    .select("id, user_id, role, subject, message, status, admin_note, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 80);

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    role: row.role as string,
    subject: row.subject as string,
    message: row.message as string,
    status: (row.status as SupportMessageStatus) ?? "open",
    adminNote: (row.admin_note as string) ?? null,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string) ?? null,
  }));
}

export async function countOpenSupportMessages(): Promise<number> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (admin as any)
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);
  return count ?? 0;
}
