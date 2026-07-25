import { createClient } from "@/lib/supabase/server";

/** Notification types that should badge the Orders / My Jobs tab. */
export const ORDER_NOTIFY_TYPES = [
  "request_received",
  "request_accepted",
  "request_rejected",
  "quote_sent",
  "quote_accepted",
  "quote_declined",
  "quote_changes_requested",
  "service_completed",
  "completion_confirmed",
  "problem_reported",
  "review_submitted",
  "offer_received",
  "offer_selected",
  "unlock_required",
  "unlock_succeeded",
  "match_assigned",
] as const;

/**
 * Unread order activity for nav badges.
 * Prefer typed filter (no fragile PostgREST `.or` strings that can throw in layout).
 */
export async function getUnreadOrderNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("marketplace_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("type", [...ORDER_NOTIFY_TYPES]);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Mark order-related notifications read when the user opens My Orders / My Jobs.
 */
export async function markOrderNotificationsRead(userId: string): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase
    .from("marketplace_notifications")
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("type", [...ORDER_NOTIFY_TYPES]);
}
