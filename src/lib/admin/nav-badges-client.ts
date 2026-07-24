import type { AdminBadgeChannel, AdminNavBadgeCounts } from "@/lib/admin/badge-ack";

/** Client-safe zero helper (no server imports). */
export function zeroChannel(
  counts: AdminNavBadgeCounts,
  channel: AdminBadgeChannel,
): AdminNavBadgeCounts {
  const next = { ...counts, [channel]: 0 };
  if (channel === "businesses") next.approvals = 0;
  return next;
}
