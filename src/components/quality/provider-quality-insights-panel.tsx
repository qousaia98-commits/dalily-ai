"use client";

import { useTranslations } from "next-intl";
import type { ProviderQualityInsights } from "@/lib/quality/types";
import type { QualityCase } from "@/lib/quality/types";
import { Link } from "@/lib/i18n/routing";
import { formatDateTime } from "@/lib/format/datetime";

type Props = {
  insights: ProviderQualityInsights;
  cases: QualityCase[];
};

export function ProviderQualityInsightsPanel({ insights, cases }: Props) {
  const t = useTranslations("quality.provider");

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("metrics.total")} value={String(insights.totalCases)} />
        <Metric label={t("metrics.open")} value={String(insights.openCases)} />
        <Metric
          label={t("metrics.resolutionRate")}
          value={
            insights.resolutionRate != null
              ? `${Math.round(insights.resolutionRate * 100)}%`
              : "—"
          }
        />
        <Metric
          label={t("metrics.avgHours")}
          value={
            insights.avgResolutionHours != null
              ? `${insights.avgResolutionHours}h`
              : "—"
          }
        />
      </div>

      {insights.recommendations.length > 0 ? (
        <section className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("recommendations")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {insights.recommendations.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold">{t("history")}</h3>
        {cases.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {cases.map((c) => (
              <li key={c.id} className="rounded-xl border px-3 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">
                    {c.caseNumber} · {c.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(c.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.status} · {c.category}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          <Link href="/business/messages" className="underline">
            {t("respondHint")}
          </Link>
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
