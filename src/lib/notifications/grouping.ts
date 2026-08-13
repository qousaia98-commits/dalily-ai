/**
 * Sprint 5 Phase 6 — smart grouping of similar notifications.
 */

import type { NotifCategory, SmartNotification } from "./types";

export function buildGroupKey(input: {
  category: NotifCategory;
  eventKey: string;
  conversationId?: string | null;
  projectId?: string | null;
}): string {
  if (input.category === "messages" || input.category === "voice") {
    return `msg:${input.conversationId ?? "global"}`;
  }
  if (input.category === "tasks") {
    return `tasks:${input.projectId ?? "global"}:${input.eventKey}`;
  }
  if (input.category === "approvals") {
    return `approvals:${input.projectId ?? "global"}`;
  }
  return `${input.category}:${input.eventKey}`;
}

export type GroupedFeedItem =
  | { kind: "single"; notification: SmartNotification }
  | {
      kind: "group";
      groupKey: string;
      representative: SmartNotification;
      count: number;
      members: SmartNotification[];
    };

/**
 * Collapse unread items sharing the same group_key into one feed row.
 * Group summaries already in DB take precedence.
 */
export function groupNotificationsForFeed(
  items: SmartNotification[],
): GroupedFeedItem[] {
  const summaries = items.filter((n) => n.isGroupSummary);
  const summaryKeys = new Set(
    summaries.map((s) => s.groupKey).filter(Boolean) as string[],
  );

  const buckets = new Map<string, SmartNotification[]>();
  const singles: SmartNotification[] = [];

  for (const item of items) {
    if (item.isGroupSummary) continue;
    if (item.groupKey && !summaryKeys.has(item.groupKey) && item.status === "unread") {
      const arr = buckets.get(item.groupKey) ?? [];
      arr.push(item);
      buckets.set(item.groupKey, arr);
    } else if (!item.groupKey || !summaryKeys.has(item.groupKey)) {
      singles.push(item);
    }
  }

  const result: GroupedFeedItem[] = [];

  for (const summary of summaries) {
    const members = items.filter(
      (n) =>
        !n.isGroupSummary &&
        n.groupKey === summary.groupKey &&
        n.status !== "deleted",
    );
    result.push({
      kind: "group",
      groupKey: summary.groupKey ?? summary.id,
      representative: summary,
      count: Math.max(summary.groupCount, members.length),
      members,
    });
  }

  for (const [key, members] of buckets) {
    if (members.length <= 1) {
      singles.push(...members);
      continue;
    }
    const sorted = [...members].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    result.push({
      kind: "group",
      groupKey: key,
      representative: sorted[0],
      count: members.length,
      members: sorted,
    });
  }

  for (const n of singles) {
    result.push({ kind: "single", notification: n });
  }

  result.sort((a, b) => {
    const na = a.kind === "single" ? a.notification : a.representative;
    const nb = b.kind === "single" ? b.notification : b.representative;
    const pa =
      (na.aiSuggestedPriority ?? na.priority) === "critical"
        ? 3
        : (na.aiSuggestedPriority ?? na.priority) === "high"
          ? 2
          : (na.aiSuggestedPriority ?? na.priority) === "normal"
            ? 1
            : 0;
    const pb =
      (nb.aiSuggestedPriority ?? nb.priority) === "critical"
        ? 3
        : (nb.aiSuggestedPriority ?? nb.priority) === "high"
          ? 2
          : (nb.aiSuggestedPriority ?? nb.priority) === "normal"
            ? 1
            : 0;
    if (pb !== pa) return pb - pa;
    return (
      new Date(nb.createdAt).getTime() - new Date(na.createdAt).getTime()
    );
  });

  return result;
}

export function groupedTitle(
  category: NotifCategory,
  count: number,
  locale: string,
): { en: string; ar: string } {
  const isAr = locale === "ar";
  void isAr;
  const map: Record<string, { en: string; ar: string }> = {
    messages: {
      en: `${count} new chat messages`,
      ar: `${count} رسائل دردشة جديدة`,
    },
    voice: {
      en: `${count} new voice messages`,
      ar: `${count} رسائل صوتية جديدة`,
    },
    tasks: {
      en: `${count} completed tasks`,
      ar: `${count} مهام مكتملة`,
    },
    approvals: {
      en: `${count} approval requests`,
      ar: `${count} طلبات موافقة`,
    },
  };
  return (
    map[category] ?? {
      en: `${count} updates`,
      ar: `${count} تحديثات`,
    }
  );
}
