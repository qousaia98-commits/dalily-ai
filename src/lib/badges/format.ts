/**
 * Shared nav badge helpers — Customer / Provider / Admin.
 * Counts only; presentation lives in NavCountBadge.
 */

export function clampBadgeCount(count: number, max = 99): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), max);
}

export function formatBadgeCount(count: number, max = 99): string {
  const n = clampBadgeCount(count, max);
  if (n <= 0) return "";
  return n >= max ? `${max}+` : String(n);
}

export type ProviderNavBadges = {
  messages: number;
  orders: number;
  opportunities: number;
  unlock: number;
  verification: number;
  /** Alias used by legacy sidebar key `requests` */
  requests: number;
};

export type CustomerNavBadges = {
  messages: number;
  orders: number;
};

export type AdminNavBadges = {
  approvals: number;
  payments: number;
  issues: number;
  messages: number;
};
