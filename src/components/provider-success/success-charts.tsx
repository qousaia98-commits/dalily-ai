"use client";

import { useTranslations } from "next-intl";
import type { ChartPoint } from "@/lib/provider-success/types";

function BarChart({
  title,
  points,
  emptyLabel,
}: {
  title: string;
  points: ChartPoint[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  if (!points.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div
        className="mt-4 flex h-36 items-end gap-1.5"
        role="img"
        aria-label={title}
      >
        {points.map((p) => (
          <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[0.65rem] text-muted-foreground">{p.value}</span>
            <div
              className="w-full rounded-t-md bg-[var(--dalily-gold)]/80"
              style={{ height: `${Math.max(8, (p.value / max) * 100)}%` }}
              title={`${p.label}: ${p.value}`}
            />
            <span className="w-full truncate text-center text-[0.6rem] text-muted-foreground">
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SuccessCharts({
  bookingsPerWeek,
  bookingsPerMonth,
  ratingTrend,
  completedJobsTrend,
}: {
  bookingsPerWeek: ChartPoint[];
  bookingsPerMonth: ChartPoint[];
  ratingTrend: ChartPoint[];
  completedJobsTrend: ChartPoint[];
}) {
  const t = useTranslations("business.success.charts");

  return (
    <section className="space-y-3" aria-labelledby="charts-title">
      <h2 id="charts-title" className="text-lg font-bold tracking-tight">
        {t("title")}
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <BarChart title={t("bookingsWeek")} points={bookingsPerWeek} emptyLabel={t("empty")} />
        <BarChart title={t("bookingsMonth")} points={bookingsPerMonth} emptyLabel={t("empty")} />
        <BarChart title={t("ratingTrend")} points={ratingTrend} emptyLabel={t("empty")} />
        <BarChart
          title={t("completedTrend")}
          points={completedJobsTrend}
          emptyLabel={t("empty")}
        />
      </div>
    </section>
  );
}
