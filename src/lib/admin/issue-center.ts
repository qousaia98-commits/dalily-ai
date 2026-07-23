/**
 * Issue Center — booking issue reports moderation (read + status updates).
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type IssueModerationStatus = "open" | "in_progress" | "resolved" | "closed";

export type AdminIssueItem = {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  reason: string;
  details: string | null;
  moderationStatus: IssueModerationStatus;
  assignedTo: string | null;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export async function listAdminIssues(params?: {
  status?: IssueModerationStatus | "all";
  limit?: number;
}): Promise<AdminIssueItem[]> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from("booking_issue_reports")
    .select(
      "id, booking_id, customer_id, provider_id, reason, details, moderation_status, assigned_to, admin_notes, created_at, resolved_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 50);

  if (params?.status && params.status !== "all") {
    query = query.eq("moderation_status", params.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    bookingId: row.booking_id as string,
    customerId: row.customer_id as string,
    providerId: row.provider_id as string,
    reason: row.reason as string,
    details: (row.details as string) ?? null,
    moderationStatus: (row.moderation_status as IssueModerationStatus) ?? "open",
    assignedTo: (row.assigned_to as string) ?? null,
    adminNotes: (row.admin_notes as string) ?? null,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string) ?? null,
  }));
}

export async function countOpenIssues(): Promise<number> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (admin as any)
    .from("booking_issue_reports")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .in("moderation_status", ["open", "in_progress"]);
  return count ?? 0;
}
