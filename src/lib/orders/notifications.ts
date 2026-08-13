import { createClient } from "@/lib/supabase/server";

/**
 * Nav badge channels — types must match what deliverMarketplaceNotification writes.
 * (Historically mismatched: match_assigned vs match_assignment, unlock_required vs unlock_opened.)
 */

export const OPPORTUNITY_NOTIFY_TYPES = [
  "match_assignment",
  "match_assigned", // legacy alias
] as const;

export const UNLOCK_NOTIFY_TYPES = [
  "unlock_opened",
  "unlock_granted",
  "unlock_fallback",
  "unlock_fallback_exhausted",
  "unlock_required", // legacy alias
  "unlock_succeeded", // legacy alias
] as const;

/** Order / My Jobs activity — excludes opportunity + unlock channels. */
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
] as const;

export const VERIFICATION_NOTIFY_TYPES = [
  "verification_approved",
  "verification_rejected",
  "verification_changes_requested",
  "verification_resubmitted",
] as const;

export type NavBadgeChannel =
  | "orders"
  | "opportunities"
  | "unlock"
  | "verification";

const CHANNEL_TYPES: Record<NavBadgeChannel, readonly string[]> = {
  orders: ORDER_NOTIFY_TYPES,
  opportunities: OPPORTUNITY_NOTIFY_TYPES,
  unlock: UNLOCK_NOTIFY_TYPES,
  verification: VERIFICATION_NOTIFY_TYPES,
};

async function countUnreadByTypes(
  userId: string,
  types: readonly string[],
): Promise<number> {
  if (types.length === 0) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("marketplace_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("type", [...types]);
  if (error) return 0;
  return count ?? 0;
}

async function markTypesRead(userId: string, types: readonly string[]): Promise<void> {
  if (types.length === 0) return;
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase
    .from("marketplace_notifications")
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("type", [...types]);
}

export async function getUnreadOrderNotificationCount(userId: string): Promise<number> {
  return countUnreadByTypes(userId, ORDER_NOTIFY_TYPES);
}

export async function getUnreadOpportunityNotificationCount(
  userId: string,
): Promise<number> {
  return countUnreadByTypes(userId, OPPORTUNITY_NOTIFY_TYPES);
}

export async function getUnreadUnlockNotificationCount(userId: string): Promise<number> {
  return countUnreadByTypes(userId, UNLOCK_NOTIFY_TYPES);
}

export async function markOrderNotificationsRead(userId: string): Promise<void> {
  await markTypesRead(userId, ORDER_NOTIFY_TYPES);
}

export async function markOpportunityNotificationsRead(userId: string): Promise<void> {
  await markTypesRead(userId, OPPORTUNITY_NOTIFY_TYPES);
}

export async function markUnlockNotificationsRead(userId: string): Promise<void> {
  await markTypesRead(userId, UNLOCK_NOTIFY_TYPES);
}

export async function getUnreadVerificationNotificationCount(
  userId: string,
): Promise<number> {
  return countUnreadByTypes(userId, VERIFICATION_NOTIFY_TYPES);
}

export async function markVerificationNotificationsRead(userId: string): Promise<void> {
  await markTypesRead(userId, VERIFICATION_NOTIFY_TYPES);
}

export async function markNavChannelNotificationsRead(
  userId: string,
  channel: NavBadgeChannel,
): Promise<void> {
  await markTypesRead(userId, CHANNEL_TYPES[channel]);
}
