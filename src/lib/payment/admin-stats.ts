/**
 * Sprint 6 Phase 2 — admin payment statistics (provider-agnostic).
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type PaymentAdminStats = {
  total: number;
  byStatus: Record<string, number>;
  byPurpose: Record<string, number>;
  paidAmountUsd: number;
  pendingReview: number;
  currentMonthPaid: number;
  previousMonthPaid: number;
  leadUnlocksPaid: number;
  businessSubscriptionsPaid: number;
};

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function monthBounds(offsetMonths: number): { from: string; to: string } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 1),
  );
  return { from: start.toISOString(), to: end.toISOString() };
}

export async function getPaymentAdminStats(): Promise<PaymentAdminStats> {
  const empty: PaymentAdminStats = {
    total: 0,
    byStatus: {},
    byPurpose: {},
    paidAmountUsd: 0,
    pendingReview: 0,
    currentMonthPaid: 0,
    previousMonthPaid: 0,
    leadUnlocksPaid: 0,
    businessSubscriptionsPaid: 0,
  };

  try {
    const { data } = await db()
      .from("payments")
      .select("purpose, payment_status, amount, currency, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    const rows = (data ?? []) as Array<{
      purpose: string;
      payment_status: string;
      amount: number;
      currency: string;
      paid_at: string | null;
      created_at: string;
    }>;

    const current = monthBounds(0);
    const previous = monthBounds(-1);
    const stats = { ...empty, byStatus: {} as Record<string, number>, byPurpose: {} as Record<string, number> };
    stats.total = rows.length;

    for (const row of rows) {
      const status = row.payment_status || "unknown";
      const purpose = row.purpose || "subscription";
      stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;
      stats.byPurpose[purpose] = (stats.byPurpose[purpose] ?? 0) + 1;

      if (status === "pending_review") stats.pendingReview += 1;

      const isPaid = status === "paid";
      const usd =
        String(row.currency ?? "").toUpperCase() === "USD"
          ? Number(row.amount ?? 0)
          : 0;
      const ts = row.paid_at || row.created_at;

      if (isPaid) {
        stats.paidAmountUsd += usd;
        if (
          purpose === "unlock_fee" ||
          purpose === "lead_unlock"
        ) {
          stats.leadUnlocksPaid += 1;
        }
        if (purpose === "business_subscription") {
          stats.businessSubscriptionsPaid += 1;
        }
        if (ts >= current.from && ts < current.to) {
          stats.currentMonthPaid += usd;
        }
        if (ts >= previous.from && ts < previous.to) {
          stats.previousMonthPaid += usd;
        }
      }
    }

    stats.paidAmountUsd = Math.round(stats.paidAmountUsd * 100) / 100;
    stats.currentMonthPaid = Math.round(stats.currentMonthPaid * 100) / 100;
    stats.previousMonthPaid = Math.round(stats.previousMonthPaid * 100) / 100;
    return stats;
  } catch {
    return empty;
  }
}
