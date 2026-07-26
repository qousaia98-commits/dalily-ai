"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { RecurringDashboard, RecurringIntervalKind } from "@/lib/recurring";
import {
  cancelRecurringPlanAction,
  createRecurringPlanAction,
  pauseRecurringPlanAction,
  renewRecurringPlanAction,
  resolveRecurringRecommendationAction,
  resumeRecurringPlanAction,
  skipRecurringVisitAction,
} from "@/actions/recurring.actions";
import { toast } from "sonner";

type Props = {
  dashboard: RecurringDashboard;
};

const INTERVALS: RecurringIntervalKind[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
  "custom",
];

export function RecurringDashboardPanel({ dashboard }: Props) {
  const t = useTranslations("recurring.dashboard");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("Garden maintenance");
  const [intervalKind, setIntervalKind] =
    useState<RecurringIntervalKind>("monthly");
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  function createPlan() {
    startTransition(async () => {
      const result = await createRecurringPlanAction({
        title,
        intervalKind,
        startDate,
        preferredTimeStart: "10:00",
        preferredTimeEnd: "12:00",
        preferredWeekdays: [6],
        durationMinutes: 60,
        autoRenew: true,
      });
      if (!result.ok) toast.error(t("error"));
      else toast.success(t("created"));
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("badge")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("metrics", {
            retention: dashboard.metrics.retentionHintPct ?? "—",
            completion: dashboard.metrics.completionRatePct ?? "—",
          })}
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("createTitle")}</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
          />
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            value={intervalKind}
            onChange={(e) =>
              setIntervalKind(e.target.value as RecurringIntervalKind)
            }
          >
            {INTERVALS.map((i) => (
              <option key={i} value={i}>
                {t(`interval.${i}`)}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <Button type="button" disabled={pending} onClick={createPlan}>
          {t("createCta")}
        </Button>
      </section>

      {dashboard.recommendations.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold">{t("aiTitle")}</h2>
          <ul className="space-y-3">
            {dashboard.recommendations.map((r) => (
              <li key={r.id} className="rounded-xl border border-border/60 p-3">
                <p className="text-sm font-medium">
                  {isAr ? r.titleAr : r.titleEn}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAr ? r.reasonAr : r.reasonEn}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await resolveRecurringRecommendationAction({
                          recommendationId: r.id,
                          accept: true,
                        });
                        if (!res.ok) toast.error(t("error"));
                        else toast.success(t("accepted"));
                      })
                    }
                  >
                    {t("accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await resolveRecurringRecommendationAction({
                          recommendationId: r.id,
                          accept: false,
                        });
                        toast.message(t("rejected"));
                      })
                    }
                  >
                    {t("reject")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PlanList
        title={t("active")}
        plans={dashboard.activePlans}
        pending={pending}
        onPause={(id) =>
          startTransition(async () => {
            await pauseRecurringPlanAction(id);
          })
        }
        onCancel={(id) =>
          startTransition(async () => {
            await cancelRecurringPlanAction(id);
          })
        }
        onRenew={(id) =>
          startTransition(async () => {
            await renewRecurringPlanAction(id);
          })
        }
        labels={{
          pause: t("pause"),
          cancel: t("cancel"),
          renew: t("renew"),
          empty: t("emptyActive"),
        }}
      />

      <PlanList
        title={t("paused")}
        plans={dashboard.pausedPlans}
        pending={pending}
        onResume={(id) =>
          startTransition(async () => {
            await resumeRecurringPlanAction(id);
          })
        }
        labels={{
          resume: t("resume"),
          empty: t("emptyPaused"),
        }}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("upcoming")}</h2>
        {dashboard.upcomingVisits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyUpcoming")}</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.upcomingVisits.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <span>
                  {v.planTitle} ·{" "}
                  {new Date(v.plannedStartsAt).toLocaleString(
                    isAr ? "ar" : "en",
                  )}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await skipRecurringVisitAction({ visitId: v.id });
                      toast.message(t("skipped"));
                    })
                  }
                >
                  {t("skip")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("completed")}</h2>
        {dashboard.completedVisits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyCompleted")}</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {dashboard.completedVisits.map((v) => (
              <li key={v.id}>
                {v.planTitle} ·{" "}
                {new Date(v.plannedStartsAt).toLocaleDateString(
                  isAr ? "ar" : "en",
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("renewals")}</h2>
        {dashboard.renewals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyRenewals")}</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {dashboard.renewals.map((r) => (
              <li key={r.planId}>
                {r.title} · {r.endDate}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("history")}</h2>
        {dashboard.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyHistory")}</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {dashboard.history.map((p) => (
              <li key={p.id}>
                {p.title} · {p.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanList({
  title,
  plans,
  pending,
  onPause,
  onCancel,
  onRenew,
  onResume,
  labels,
}: {
  title: string;
  plans: RecurringDashboard["activePlans"];
  pending: boolean;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRenew?: (id: string) => void;
  onResume?: (id: string) => void;
  labels: Record<string, string>;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="space-y-2">
          {plans.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              <p className="font-medium">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {p.intervalKind}
                {p.nextVisitAt
                  ? ` · next ${new Date(p.nextVisitAt).toLocaleDateString()}`
                  : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {onPause ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onPause(p.id)}
                  >
                    {labels.pause}
                  </Button>
                ) : null}
                {onResume ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => onResume(p.id)}
                  >
                    {labels.resume}
                  </Button>
                ) : null}
                {onRenew ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onRenew(p.id)}
                  >
                    {labels.renew}
                  </Button>
                ) : null}
                {onCancel ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => onCancel(p.id)}
                  >
                    {labels.cancel}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
