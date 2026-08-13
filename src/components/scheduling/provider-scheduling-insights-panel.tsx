"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ProviderScheduleInsights } from "@/lib/scheduling-engine/types";
import {
  acceptOpportunityAction,
  ignoreOpportunityAction,
} from "@/actions/scheduling.actions";
import { Button } from "@/components/ui/button";

type Props = { insights: ProviderScheduleInsights };

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

export function ProviderSchedulingInsightsPanel({ insights }: Props) {
  const t = useTranslations("scheduling.provider");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const opt = insights.optimization;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("stats.utilization")}
          value={`${Math.round(insights.utilization * 100)}%`}
        />
        <Stat
          label={t("stats.idle")}
          value={opt ? `${opt.idleMinutes} m` : "—"}
        />
        <Stat
          label={t("stats.travel")}
          value={opt ? `${opt.travelMinutes} m` : "—"}
        />
        <Stat
          label={t("stats.burnout")}
          value={`${Math.round(insights.burnoutRisk * 100)}%`}
        />
      </div>

      {opt ? (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("optimizedTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("departure")}: {opt.departureTime ? new Date(opt.departureTime).toLocaleTimeString() : "—"} ·{" "}
            {t("finish")}:{" "}
            {opt.expectedFinish
              ? new Date(opt.expectedFinish).toLocaleTimeString()
              : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("lunch")}: {opt.lunchRecommendation} · {t("break")}: {opt.breakSchedule}
          </p>
          <p className="text-sm">
            {t("revenue")}: {money(opt.revenueForecast, insights.currency, locale)} ·{" "}
            {t("opportunityScore")}: {Math.round(insights.opportunityScore * 100)}%
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {opt.orderedStops.map((s) => (
              <li key={s.bookingId} className="rounded-xl border px-3 py-2">
                #{s.suggestedOrder} · {s.noteEn}
              </li>
            ))}
          </ul>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {opt.explanations.map((e) => (
              <li key={e.code}>
                {locale === "ar" && e.labelAr ? e.labelAr : e.labelEn}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {insights.capacity ? (
        <section className="rounded-2xl border p-4 text-sm">
          <h2 className="font-semibold">{t("capacityTitle")}</h2>
          <p className="mt-2 text-muted-foreground">
            {t("remaining")}: {insights.capacity.remainingCapacity}/
            {insights.capacity.maxDailyJobs} · {t("overbooking")}:{" "}
            {Math.round(insights.capacity.overbookingRisk * 100)}%
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("opportunitiesTitle")}</h2>
        {insights.opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("opportunitiesEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {insights.opportunities.map((o, idx) => (
              <li
                key={`${o.titleEn}-${idx}`}
                className="rounded-2xl border bg-card p-4 text-sm"
              >
                <p className="font-medium">
                  {locale === "ar" && o.titleAr ? o.titleAr : o.titleEn}
                </p>
                <p className="mt-1 text-muted-foreground">
                  +{money(o.expectedEarnings, o.currency, locale)} · +
                  {o.travelMinutes}m travel · {o.expectedDurationMin}m job · score{" "}
                  {Math.round(o.opportunityScore * 100)}%
                </p>
                {o.id ? (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      className="rounded-xl"
                      onClick={() =>
                        start(async () => {
                          await acceptOpportunityAction({ opportunityId: o.id! });
                        })
                      }
                    >
                      {t("accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      className="rounded-xl"
                      onClick={() =>
                        start(async () => {
                          await ignoreOpportunityAction({ opportunityId: o.id! });
                        })
                      }
                    >
                      {t("ignore")}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
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
