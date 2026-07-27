"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  acknowledgeAlertAction,
  completeOpsTaskAction,
  createInvestigationFromOpsAction,
  createOpsTaskAction,
  exportOpsReportAction,
  openQualityCaseFromOpsAction,
  refreshAiOpsAction,
  resolveAlertAction,
} from "@/actions/ai-ops.actions";
import type { AiOpsDashboard } from "@/lib/ai-ops/queries";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";
import { formatDateTime } from "@/lib/format/datetime";

type Props = { data: AiOpsDashboard };

export function AdminAiOpsDashboardPanel({ data }: Props) {
  const t = useTranslations("admin.aiOps");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [exportText, setExportText] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  const h = data.health;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          className="rounded-xl"
          onClick={() => run(() => refreshAiOpsAction())}
        >
          {t("actions.refresh")}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          className="rounded-xl"
          onClick={() =>
            start(async () => {
              const res = await exportOpsReportAction();
              if (res.reportText) setExportText(res.reportText);
            })
          }
        >
          {t("actions.export")}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          className="rounded-xl"
          onClick={() =>
            run(() =>
              createInvestigationFromOpsAction({
                title: "Ops-triggered fraud investigation",
              }),
            )
          }
        >
          {t("actions.createInvestigation")}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          className="rounded-xl"
          onClick={() =>
            run(() =>
              openQualityCaseFromOpsAction({
                title: "Ops-triggered quality case",
                description:
                  "Opened from AI Operations action center for follow-up.",
              }),
            )
          }
        >
          {t("actions.openQualityCase")}
        </Button>
      </div>

      {exportText ? (
        <pre className="max-h-64 overflow-auto rounded-2xl border bg-muted/40 p-4 text-xs whitespace-pre-wrap">
          {exportText}
        </pre>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("health.title")}
          </h2>
          <span className="text-sm font-medium">
            {t(`health.levels.${h.systemHealth}`)} · {h.overallScore}/100
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Kpi label={t("kpis.activeUsers")} value={h.activeUsers} />
          <Kpi label={t("kpis.bookingsToday")} value={h.bookingsToday} />
          <Kpi label={t("kpis.completedJobs")} value={h.completedJobs} />
          <Kpi label={t("kpis.openCases")} value={h.openCases} />
          <Kpi label={t("kpis.escalatedCases")} value={h.escalatedCases} />
          <Kpi label={t("kpis.fraudAlerts")} value={h.fraudAlerts} />
          <Kpi label={t("kpis.reviews")} value={h.reviewCountPeriod} />
          <Kpi label={t("kpis.verificationPending")} value={h.verificationPending} />
          <Kpi label={t("kpis.verificationVerified")} value={h.verificationVerified} />
          <Kpi
            label={t("kpis.paymentSuccess")}
            value={
              h.paymentSuccessRate != null
                ? `${Math.round(h.paymentSuccessRate * 100)}%`
                : "—"
            }
          />
          <Kpi
            label={t("kpis.refundRate")}
            value={
              h.refundRate != null ? `${Math.round(h.refundRate * 100)}%` : "—"
            }
          />
          <Kpi label={t("kpis.systemHealth")} value={t(`health.levels.${h.systemHealth}`)} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("trust.title")}
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {Object.keys(h.trustDistribution).length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("trust.empty")}</li>
          ) : (
            Object.entries(h.trustDistribution).map(([level, count]) => (
              <li key={level} className="rounded-lg border px-3 py-1 text-sm">
                {level}: {count}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("insights.title")}
        </h2>
        <ul className="mt-2 space-y-2">
          {data.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("insights.empty")}</p>
          ) : (
            data.insights.map((i) => (
              <li
                key={i.id}
                className="rounded-xl border bg-card px-3 py-2 text-sm"
              >
                <span className="text-xs uppercase text-muted-foreground">
                  {t(`insights.tones.${i.tone}`)}
                </span>
                <p className="mt-0.5">{i.message}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("alerts.title")}
        </h2>
        <ul className="mt-2 space-y-2">
          {data.alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
          ) : (
            data.alerts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {a.title} · {t(`severity.${a.severity}`)} · {t(`alertStatus.${a.status}`)}
                  </p>
                  {a.body ? (
                    <p className="text-xs text-muted-foreground">{a.body}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending || a.status === "acknowledged"}
                    onClick={() =>
                      run(() => acknowledgeAlertAction({ alertId: a.id }))
                    }
                  >
                    {t("actions.acknowledge")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => resolveAlertAction({ alertId: a.id }))
                    }
                  >
                    {t("actions.resolve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        createOpsTaskAction({
                          title: `Follow up: ${a.title}`,
                          body: a.body ?? undefined,
                          alertId: a.id,
                          relatedHref: "/admin/ai-ops",
                        }),
                      )
                    }
                  >
                    {t("actions.assignTask")}
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("anomalies.title")}
        </h2>
        <ul className="mt-2 space-y-2">
          {data.anomalies.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("anomalies.empty")}</p>
          ) : (
            data.anomalies.map((a) => (
              <li key={a.id} className="rounded-xl border px-3 py-2 text-sm">
                <p className="font-medium">
                  {a.title} · {t(`severity.${a.severity}`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.summary} · {formatDateTime(a.detectedAt)}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("trends.title")}
        </h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.trends.map((tr) => (
            <li key={tr.id} className="rounded-xl border px-3 py-2 text-sm">
              <p className="font-medium">{tr.metricKey}</p>
              <p className="text-xs text-muted-foreground">
                {tr.value} · {tr.changePct ?? 0}% {tr.direction} · {tr.period}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("categories.title")}
          </h2>
          <ul className="mt-2 space-y-2">
            {data.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("categories.empty")}</p>
            ) : (
              data.categories.map((c) => (
                <li key={c.categoryId} className="rounded-xl border px-3 py-2 text-sm">
                  <p className="font-medium">
                    {c.categoryName ?? c.categoryId} · {c.trustLevel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("categories.score")}: {c.healthScore} · providers{" "}
                    {c.providerCount}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("regions.title")}
          </h2>
          <ul className="mt-2 space-y-2">
            {data.regions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("regions.empty")}</p>
            ) : (
              data.regions.map((r) => (
                <li key={r.regionKey} className="rounded-xl border px-3 py-2 text-sm">
                  <p className="font-medium">{r.regionName ?? r.regionKey}</p>
                  <p className="text-xs text-muted-foreground">
                    density {r.providerDensity} · demand {r.demandCount} · score{" "}
                    {r.healthScore}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("tasks.title")}
        </h2>
        <ul className="mt-2 space-y-2">
          {data.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("tasks.empty")}</p>
          ) : (
            data.tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.status} · {task.priority}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => completeOpsTaskAction({ taskId: task.id }))
                  }
                >
                  {t("actions.completeTask")}
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        <Link href="/admin/fraud" className="underline">
          {t("links.fraud")}
        </Link>
        {" · "}
        <Link href="/admin/quality" className="underline">
          {t("links.quality")}
        </Link>
        {" · "}
        <Link href="/admin/health" className="underline">
          {t("links.systemHealth")}
        </Link>
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
