/**
 * Admin Operations Center — pure presentation helpers.
 * No DB writes; consumes existing overview / badge counts.
 */

export type OpsAttentionCounts = {
  pendingBusinesses: number;
  pendingPayments: number;
  pendingVerifications: number;
  openIssues: number;
  changesRequested: number;
  unreadMessages: number;
};

export type PlatformHealthLevel = "healthy" | "attention" | "critical";

/**
 * Platform health from operational queues:
 * - critical: open reports that need follow-up
 * - attention: pending reviews / payments / verification / messages
 * - healthy: nothing waiting
 */
export function resolvePlatformHealth(counts: OpsAttentionCounts): PlatformHealthLevel {
  if (counts.openIssues > 0) return "critical";
  const pending =
    counts.pendingBusinesses +
    counts.pendingPayments +
    counts.pendingVerifications +
    counts.changesRequested +
    counts.unreadMessages;
  if (pending > 0) return "attention";
  return "healthy";
}

export type OpsPriority = {
  id: string;
  href: string;
  count: number;
  /** i18n key under admin.controlCenter.priorities.items.* */
  messageKey: string;
};

/** Clickable “today priorities” — only items with count > 0, max 5. */
export function buildOpsPriorities(counts: OpsAttentionCounts): OpsPriority[] {
  const candidates: OpsPriority[] = [
    {
      id: "payments",
      href: "/admin/payments?tab=pending_review",
      count: counts.pendingPayments,
      messageKey: "payments",
    },
    {
      id: "verification",
      href: "/admin/verification",
      count: counts.pendingVerifications,
      messageKey: "verification",
    },
    {
      id: "businesses",
      href: "/admin/providers?status=pending_review",
      count: counts.pendingBusinesses,
      messageKey: "businesses",
    },
    {
      id: "issues",
      href: "/admin/issues",
      count: counts.openIssues,
      messageKey: "issues",
    },
    {
      id: "changes",
      href: "/admin/providers?status=changes_requested",
      count: counts.changesRequested,
      messageKey: "changes",
    },
    {
      id: "messages",
      href: "/admin/messages",
      count: counts.unreadMessages,
      messageKey: "messages",
    },
  ];

  return candidates.filter((p) => p.count > 0).slice(0, 5);
}

export function totalAttention(counts: OpsAttentionCounts): number {
  return (
    counts.pendingBusinesses +
    counts.pendingPayments +
    counts.pendingVerifications +
    counts.openIssues +
    counts.changesRequested +
    counts.unreadMessages
  );
}
