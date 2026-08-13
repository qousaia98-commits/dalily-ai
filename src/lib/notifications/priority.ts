/**
 * Sprint 5 Phase 6 — priority engine.
 * AI may suggest a boost; never mutates business data.
 */

import type { NotifCategory, NotifPriority } from "./types";

const CATEGORY_BASE: Record<NotifCategory, NotifPriority> = {
  emergency: "critical",
  bookings: "high",
  approvals: "high",
  payments: "high",
  invoices: "high",
  messages: "normal",
  voice: "normal",
  tasks: "normal",
  projects: "normal",
  recurring: "normal",
  marketplace: "normal",
  admin: "high",
  system: "low",
};

const EVENT_BOOST: Record<string, NotifPriority> = {
  emergency_dispatch: "critical",
  emergency_arrived: "critical",
  payment_failed: "critical",
  approval_requested: "high",
  booking_accepted: "high",
  invoice_due: "high",
  chat_message: "normal",
  voice_message: "normal",
  task_completed: "low",
  digest: "low",
};

const RANK: Record<NotifPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

export function maxPriority(a: NotifPriority, b: NotifPriority): NotifPriority {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * Deterministic base priority from category + event.
 */
export function resolveBasePriority(input: {
  category: NotifCategory;
  eventKey: string;
}): NotifPriority {
  const fromEvent = EVENT_BOOST[input.eventKey];
  const fromCategory = CATEGORY_BASE[input.category];
  if (fromEvent) return maxPriority(fromEvent, fromCategory);
  return fromCategory;
}

/**
 * Soft AI suggestion: elevate chat floods / overdue approvals, never lower critical.
 * Does not write business rows — caller may store ai_suggested_priority only.
 */
export function suggestAiPriority(input: {
  category: NotifCategory;
  eventKey: string;
  basePriority: NotifPriority;
  unreadSameGroup?: number;
  isOverdue?: boolean;
}): NotifPriority {
  let suggested = input.basePriority;

  if (input.isOverdue && input.category === "approvals") {
    suggested = maxPriority(suggested, "high");
  }
  if ((input.unreadSameGroup ?? 0) >= 5 && input.category === "messages") {
    suggested = maxPriority(suggested, "high");
  }
  if (input.category === "emergency") {
    suggested = "critical";
  }
  // Never demote critical via AI suggestion path
  if (input.basePriority === "critical") return "critical";
  return suggested;
}

export function prioritySortWeight(p: NotifPriority): number {
  return RANK[p] ?? 0;
}
