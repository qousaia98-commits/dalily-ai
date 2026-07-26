"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ChartPoint } from "@/lib/finance-analytics";
import { cn } from "@/lib/utils";

function InteractiveBarChart({
  title,
  points,
  emptyLabel,
  formatValue,
}: {
  title: string;
  points: ChartPoint[];
  emptyLabel: string;
  formatValue?: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const fmt = formatValue ?? ((n: number) => String(n));

  if (!points.length || points.every((p) => p.value === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  const active = points.find((p) => p.label === hover) ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {active ? (
          <p className="text-xs font-medium text-[var(--dalily-navy)]">
            {active.label}: {fmt(active.value)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Hover a bar</p>
        )}
      </div>
      <div
        className="mt-4 flex h-40 items-end gap-1"
        role="img"
        aria-label={title}
      >
        {points.map((p) => (
          <button
            key={p.label}
            type="button"
            className="flex min-w-0 flex-1 flex-col items-center gap-1 outline-none"
            onMouseEnter={() => setHover(p.label)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p.label)}
            onBlur={() => setHover(null)}
            title={`${p.label}: ${fmt(p.value)}`}
          >
            <div
              className={cn(
                "w-full rounded-t-md transition",
                hover === p.label
                  ? "bg-[var(--dalily-navy)]"
                  : "bg-[var(--dalily-gold)]/75",
              )}
              style={{ height: `${Math.max(4, (p.value / max) * 100)}%` }}
            />
            <span className="w-full truncate text-center text-[0.55rem] text-muted-foreground">
              {p.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FinanceChartsGrid({
  charts,
}: {
  charts: {
    dailyRevenue: ChartPoint[];
    monthlyRevenue: ChartPoint[];
    subscriptionGrowth: ChartPoint[];
    leadRevenue: ChartPoint[];
    refundTrend: ChartPoint[];
    mrrTrend: ChartPoint[];
    arrTrend: ChartPoint[];
  };
}) {
  const t = useTranslations("admin.finance");
  const money = (n: number) => `$${n.toLocaleString()}`;

  return (
    <section className="space-y-3" aria-labelledby="finance-charts-title">
      <h2 id="finance-charts-title" className="text-lg font-semibold">
        {t("chartsTitle")}
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <InteractiveBarChart
          title={t("charts.dailyRevenue")}
          points={charts.dailyRevenue}
          emptyLabel={t("emptyChart")}
          formatValue={money}
        />
        <InteractiveBarChart
          title={t("charts.monthlyRevenue")}
          points={charts.monthlyRevenue}
          emptyLabel={t("emptyChart")}
          formatValue={money}
        />
        <InteractiveBarChart
          title={t("charts.subscriptionGrowth")}
          points={charts.subscriptionGrowth}
          emptyLabel={t("emptyChart")}
        />
        <InteractiveBarChart
          title={t("charts.leadRevenue")}
          points={charts.leadRevenue}
          emptyLabel={t("emptyChart")}
          formatValue={money}
        />
        <InteractiveBarChart
          title={t("charts.refundTrend")}
          points={charts.refundTrend}
          emptyLabel={t("emptyChart")}
          formatValue={money}
        />
        <InteractiveBarChart
          title={t("charts.mrrTrend")}
          points={charts.mrrTrend}
          emptyLabel={t("emptyChart")}
          formatValue={money}
        />
        <InteractiveBarChart
          title={t("charts.arrTrend")}
          points={charts.arrTrend}
          emptyLabel={t("emptyChart")}
          formatValue={money}
        />
      </div>
    </section>
  );
}
