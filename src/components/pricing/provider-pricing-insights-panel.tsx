"use client";

import { useTranslations, useLocale } from "next-intl";
import type { ProviderPricingInsights } from "@/lib/pricing-engine/types";

type Props = { insights: ProviderPricingInsights };

function money(n: number | null, currency: string, locale: string): string {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar" : "en", {
      style: "currency",
      currency: currency === "SYP" ? "SYP" : currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

export function ProviderPricingInsightsPanel({ insights }: Props) {
  const t = useTranslations("pricing.provider");
  const locale = useLocale();
  const s = insights.suggested;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label={t("stats.suggestedRange")}
          value={
            s
              ? `${money(s.suggestedMin, s.currency, locale)} – ${money(s.suggestedPremium, s.currency, locale)}`
              : "—"
          }
        />
        <Stat
          label={t("stats.marketAverage")}
          value={money(insights.marketAverage, insights.currency, locale)}
        />
        <Stat
          label={t("stats.pastAccepted")}
          value={money(insights.pastAcceptedAvg, insights.currency, locale)}
        />
        <Stat
          label={t("stats.acceptanceRate")}
          value={
            insights.acceptanceRate != null
              ? `${Math.round(insights.acceptanceRate * 100)}%`
              : "—"
          }
        />
        <Stat
          label={t("stats.competitiveness")}
          value={t(`competitiveness.${insights.competitiveness}`)}
        />
        <Stat
          label={t("stats.confidence")}
          value={s ? `${Math.round(s.confidence * 100)}%` : "—"}
        />
      </div>

      {s ? (
        <section className="rounded-2xl border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">{t("aiTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("suggestedAvg")}: {money(s.suggestedAvg, s.currency, locale)} ·{" "}
            {t(`position.${s.marketPosition}`)}
          </p>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {s.explanations.map((e) => (
              <li key={e.code}>
                {locale === "ar" && e.labelAr ? e.labelAr : e.labelEn}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("neverForced")}</p>
        </section>
      ) : null}

      {insights.recommendations.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("tipsTitle")}</h2>
          <ul className="space-y-2">
            {insights.recommendations.map((r) => (
              <li key={r} className="rounded-xl border px-3 py-2 text-sm">
                {r}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
