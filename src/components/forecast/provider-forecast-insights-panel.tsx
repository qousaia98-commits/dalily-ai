"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ProviderForecastInsights } from "@/lib/forecast-engine/types";
import { acceptProviderForecastAction } from "@/actions/forecast.actions";
import { Button } from "@/components/ui/button";

type Props = { insights: ProviderForecastInsights };

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

export function ProviderForecastInsightsPanel({ insights }: Props) {
  const t = useTranslations("forecast.provider");
  const locale = useLocale();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label={t("stats.staffing")}
          value={
            insights.recommendedStaffing != null
              ? String(insights.recommendedStaffing)
              : "—"
          }
        />
        <Stat
          label={t("stats.revenue")}
          value={money(insights.revenueOpportunity, insights.currency, locale)}
        />
        <Stat
          label={t("stats.busy")}
          value={insights.busyPeriods[0] ?? "—"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("horizonsTitle")}</h2>
        <ul className="space-y-2">
          {insights.horizons.map((h) => (
            <li key={h.horizon} className="rounded-2xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {t(`horizon.${h.horizon}`)} · {t(`trend.${h.trend}`)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {t("expectedDemand")}: {h.expectedDemand} · {t("confidence")}:{" "}
                    {Math.round(h.confidence * 100)}% · {t("capacity")}:{" "}
                    {h.recommendedCapacity}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 ps-5">
                    {h.explanations.map((e) => (
                      <li key={e.code}>
                        {locale === "ar" && e.labelAr ? e.labelAr : e.labelEn}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  className="rounded-xl"
                  onClick={() =>
                    start(async () => {
                      await acceptProviderForecastAction({ horizon: h.horizon });
                    })
                  }
                >
                  {t("accept")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <h3 className="text-sm font-semibold">{t("bestHours")}</h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            {insights.bestWorkingHours.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border p-4">
          <h3 className="text-sm font-semibold">{t("vacation")}</h3>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            {insights.suggestedVacationWindows.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">{t("advisory")}</p>
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
