"use client";

import { useTranslations } from "next-intl";
import type { PaymentAdminStats } from "@/lib/payment/admin-stats";

export function AdminPaymentStatsCards({ stats }: { stats: PaymentAdminStats }) {
  const t = useTranslations("admin.payments.stats");

  const cards = [
    { label: t("total"), value: String(stats.total) },
    { label: t("pendingReview"), value: String(stats.pendingReview) },
    {
      label: t("paidUsd"),
      value: `$${stats.paidAmountUsd.toFixed(2)}`,
    },
    {
      label: t("currentMonth"),
      value: `$${stats.currentMonthPaid.toFixed(2)}`,
    },
    {
      label: t("previousMonth"),
      value: `$${stats.previousMonthPaid.toFixed(2)}`,
    },
    {
      label: t("leadUnlocks"),
      value: String(stats.leadUnlocksPaid),
    },
    {
      label: t("businessSubs"),
      value: String(stats.businessSubscriptionsPaid),
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border bg-card px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{card.value}</p>
        </div>
      ))}
    </section>
  );
}
