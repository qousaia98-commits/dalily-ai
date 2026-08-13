"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ProviderBusinessAssistant } from "@/lib/business-assistant/types";
import {
  acceptBusinessRecommendationAction,
  dismissBusinessRecommendationAction,
  upsertBusinessGoalAction,
} from "@/actions/business-assistant.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

type Props = { data: ProviderBusinessAssistant };

function money(n: number, currency: string, locale: string): string {
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

export function ProviderBusinessAssistantPanel({ data }: Props) {
  const t = useTranslations("businessAssistant.provider");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("10");
  const o = data.overview;
  const briefing = data.briefing;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("stats.health")} value={`${Math.round(o.businessHealthScore * 100)}%`} />
        <Stat label={t("stats.revenue")} value={money(o.revenue, o.currency, locale)} />
        <Stat label={t("stats.bookings")} value={o.bookings} />
        <Stat label={t("stats.acceptance")} value={`${Math.round(o.acceptanceRate * 100)}%`} />
        <Stat label={t("stats.completion")} value={`${Math.round(o.completionRate * 100)}%`} />
        <Stat label={t("stats.cancellation")} value={`${Math.round(o.cancellationRate * 100)}%`} />
        <Stat
          label={t("stats.response")}
          value={o.responseTimeMin != null ? `${o.responseTimeMin} m` : "—"}
        />
        <Stat
          label={t("stats.satisfaction")}
          value={
            o.customerSatisfaction != null
              ? `${Math.round(o.customerSatisfaction * 100)}%`
              : "—"
          }
        />
        <Stat label={t("stats.trust")} value={`${Math.round(o.trustLevel * 100)}%`} />
        <Stat label={t("stats.reputation")} value={t(`trend.${o.reputationTrend}`)} />
        <Stat label={t("stats.capacity")} value={`${Math.round(o.capacityUsage * 100)}%`} />
        {data.benchmark ? (
          <Stat label={t("stats.benchmark")} value={t(`cohort.${data.benchmark.cohort}`)} />
        ) : null}
      </div>

      {briefing ? (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("briefingTitle")}</h2>
          <p className="text-sm">
            {locale === "ar" && briefing.summaryAr
              ? briefing.summaryAr
              : briefing.summaryEn}
          </p>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>
              {t("todaysBookings")}: {briefing.todaysBookings}
            </li>
            <li>
              {t("revenueForecast")}:{" "}
              {briefing.revenueForecast != null
                ? money(briefing.revenueForecast, o.currency, locale)
                : "—"}
            </li>
            <li>
              {t("busyHours")}: {briefing.busyHours.join(", ")}
            </li>
            <li>
              {t("reminders")}: {briefing.reminders[0]}
            </li>
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("insightsTitle")}</h2>
        <ul className="space-y-2">
          {data.insights.map((i) => (
            <li key={i.code} className="rounded-xl border px-3 py-2 text-sm">
              {locale === "ar" && i.labelAr ? i.labelAr : i.labelEn}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("recsTitle")}</h2>
        <ul className="space-y-2">
          {data.recommendations.map((r, idx) => (
            <li key={`${r.code}-${idx}`} className="rounded-2xl border bg-card p-4 text-sm">
              <p className="font-medium">
                {locale === "ar" && r.titleAr ? r.titleAr : r.titleEn}
              </p>
              {(r.bodyEn || r.bodyAr) && (
                <p className="mt-1 text-muted-foreground">
                  {locale === "ar" && r.bodyAr ? r.bodyAr : r.bodyEn}
                </p>
              )}
              {r.id ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    className="rounded-xl"
                    onClick={() =>
                      start(async () => {
                        await acceptBusinessRecommendationAction({
                          recommendationId: r.id!,
                        });
                        router.refresh();
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
                        await dismissBusinessRecommendationAction({
                          recommendationId: r.id!,
                        });
                        router.refresh();
                      })
                    }
                  >
                    {t("dismiss")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("growthTitle")}</h2>
        <ul className="space-y-2">
          {data.growth.map((g) => (
            <li key={g.code} className="rounded-xl border px-3 py-2 text-sm">
              {locale === "ar" && g.titleAr ? g.titleAr : g.titleEn}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="text-sm font-semibold">{t("goalsTitle")}</h2>
        {data.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("goalsEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {data.goals.map((g) => (
              <li key={g.id} className="rounded-xl border px-3 py-2 text-sm">
                {g.title} · {Math.round(g.progressPct * 100)}% ({g.currentValue}/
                {g.targetValue}
                {g.unit ? ` ${g.unit}` : ""})
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Input
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder={t("goalPlaceholder")}
            className="max-w-xs rounded-xl"
          />
          <Input
            type="number"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            className="w-28 rounded-xl"
          />
          <Button
            size="sm"
            disabled={pending}
            className="rounded-xl"
            onClick={() =>
              start(async () => {
                await upsertBusinessGoalAction({
                  goalType: "bookings",
                  title: goalTitle || "Monthly bookings",
                  targetValue: Number(goalTarget) || 10,
                  currentValue: o.bookings,
                  unit: "bookings",
                });
                setGoalTitle("");
                router.refresh();
              })
            }
          >
            {t("addGoal")}
          </Button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">{t("advisory")}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
