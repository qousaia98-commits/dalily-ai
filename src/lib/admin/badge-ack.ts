/**
 * Admin Control Center unread acknowledgements.
 * Reuses the cookie watermark pattern from message-read-state (dalily_msg_read).
 * Badge = pending items newer than lastSeen — not a second notification system.
 */

export const ADMIN_SEEN_COOKIE = "dalily_admin_seen";

export const ADMIN_BADGE_CHANNELS = [
  "businesses",
  "payments",
  "issues",
  "verification",
  "reviews",
  "messages",
  "bookings",
  "broadcasts",
  "audit",
  "subscriptions",
] as const;

export type AdminBadgeChannel = (typeof ADMIN_BADGE_CHANNELS)[number];

export type AdminSeenMap = Partial<Record<AdminBadgeChannel, string>>;

export type AdminNavBadgeCounts = Partial<Record<AdminBadgeChannel, number>> & {
  /** Mobile nav alias for businesses */
  approvals?: number;
};

export function isAdminBadgeChannel(value: string): value is AdminBadgeChannel {
  return (ADMIN_BADGE_CHANNELS as readonly string[]).includes(value);
}

export function parseAdminSeenCookie(raw: string | undefined): AdminSeenMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: AdminSeenMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isAdminBadgeChannel(key)) continue;
      if (typeof value === "string" && value.length > 0) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeAdminSeenCookie(map: AdminSeenMap): string {
  return encodeURIComponent(JSON.stringify(map));
}

/** Map admin pathname → badge channel to acknowledge on visit. */
export function resolveAdminBadgeChannel(pathname: string): AdminBadgeChannel | null {
  const path = pathname.replace(/^\/(ar|en)(?=\/)/, "") || pathname;

  if (path.startsWith("/admin/providers")) return "businesses";
  if (path.startsWith("/admin/verification")) return "verification";
  if (path.startsWith("/admin/payments")) return "payments";
  if (path.startsWith("/admin/issues")) return "issues";
  if (path.startsWith("/admin/reviews")) return "reviews";
  if (path.startsWith("/admin/messages")) return "messages";
  if (path.startsWith("/admin/broadcasts")) return "broadcasts";
  if (path.startsWith("/admin/audit")) return "audit";
  if (path.startsWith("/admin/subscriptions")) return "subscriptions";
  if (path.startsWith("/admin/bookings")) return "bookings";
  return null;
}
