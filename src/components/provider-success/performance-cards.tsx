"use client";

import { useTranslations } from "next-intl";
import type { PerformanceMetrics } from "@/lib/provider-success/types";

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v == null) return "—";
  return `${v}${suffix}`;
}

export function PerformanceCards({
  metrics,
  hideHeader = false,
}: {
  metrics: PerformanceMetrics;
  hideHeader?: boolean;
}) {
  const t = useTranslations("business.success.performance");

  const items: Array<{ key: keyof PerformanceMetrics; suffix?: string }> = [
    { key: "jobsThisWeek" },
    { key: "jobsThisMonth" },
    { key: "completionRate", suffix: "%" },
    { key: "avgResponseTimeHours", suffix: "h" },
    { key: "averageRating" },
    { key: "reviewCount" },
    { key: "avgConfirmationTimeHours", suffix: "h" },
    { key: "repeatCustomers" },
    { key: "profileViews" },
    { key: "searchAppearances" },
    { key: "bookingConversionRate", suffix: "%" },
  ];

  return (
    <section className="space-y-3" aria-labelledby={hideHeader ? undefined : "perf-title"}>
      {!hideHeader ? (
        <div>
          <h2 id="perf-title" className="text-lg font-bold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(({ key, suffix }) => (
          <div
            key={key}
            className="rounded-2xl border border-border bg-card p-3 shadow-sm"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(key)}
            </p>
            <p className="mt-2 text-xl font-bold">{fmt(metrics[key], suffix)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
