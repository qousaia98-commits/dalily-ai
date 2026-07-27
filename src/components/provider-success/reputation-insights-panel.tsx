"use client";

import { useTranslations } from "next-intl";
import type { ProviderReputationInsights } from "@/lib/reputation/types";
import { cn } from "@/lib/utils";

type Props = {
  insights: ProviderReputationInsights;
};

export function ProviderReputationInsightsPanel({ insights }: Props) {
  const t = useTranslations("business.reputationInsights");

  return (
    <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h3 className="text-lg font-semibold">{t("title")}</h3>
        </div>
        <div className="text-end">
          <p className="text-sm font-semibold text-[var(--dalily-navy)]">
            {t(`levels.${insights.trustLevel}`)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(`trend.${insights.trend}`)}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label={t("metrics.completedJobs")} value={String(insights.metrics.completedJobs)} />
        <Metric
          label={t("metrics.cancellationRate")}
          value={
            insights.metrics.cancellationRate != null
              ? `${Math.round(insights.metrics.cancellationRate * 100)}%`
              : "—"
          }
        />
        <Metric
          label={t("metrics.responseTime")}
          value={
            insights.metrics.responseTimeHours != null
              ? `${insights.metrics.responseTimeHours.toFixed(1)}h`
              : "—"
          }
        />
        <Metric
          label={t("metrics.recommendationRate")}
          value={
            insights.metrics.recommendationRate != null
              ? `${Math.round(insights.metrics.recommendationRate)}%`
              : "—"
          }
        />
      </dl>

      {insights.strengths.length > 0 ? (
        <section>
          <h4 className="text-sm font-semibold">{t("strengths")}</h4>
          <ul className="mt-1 space-y-1 text-sm text-foreground/90">
            {insights.strengths.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {insights.improvements.length > 0 ? (
        <section>
          <h4 className="text-sm font-semibold">{t("improvements")}</h4>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
            {insights.improvements.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {insights.suggestions.length > 0 ? (
        <section className="rounded-xl bg-muted/40 px-3 py-2">
          <h4 className="text-sm font-semibold">{t("suggestions")}</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {insights.suggestions.slice(0, 3).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {insights.monthlyTrend.length > 1 ? (
        <section>
          <h4 className="text-sm font-semibold">{t("monthlyTrend")}</h4>
          <ol className="mt-2 flex flex-wrap gap-2">
            {insights.monthlyTrend.map((point) => (
              <li
                key={point.at}
                className={cn(
                  "rounded-lg border px-2 py-1 text-xs",
                  point.trustLevel === "excellent" && "border-emerald-500/40",
                )}
                title={`${point.score}`}
              >
                {t(`levels.${point.trustLevel}`)}
              </li>
            ))}
          </ol>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("scorePrivateNote")}</p>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
