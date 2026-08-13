"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  runMarketplaceSimulationAction,
  setMarketplaceMlExperimentAction,
} from "@/actions/marketplace-intelligence.actions";
import type { AdminMarketplaceCenter } from "@/lib/marketplace-intelligence/admin";
import { Button } from "@/components/ui/button";

type Props = { data: AdminMarketplaceCenter };

export function AdminMarketplaceIntelligencePanel({ data }: Props) {
  const t = useTranslations("admin.marketplaceIntelligence");
  const router = useRouter();
  const [pending, start] = useTransition();
  const g = data.platform.global;
  const report = data.platform.executiveReport;
  const ml = data.modules.find((m) => m.key === "ml_ensemble");

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("stats.health")} value={`${Math.round(g.healthScore * 100)}%`} />
        <Stat label={t("stats.liquidity")} value={`${Math.round(g.marketplaceLiquidity * 100)}%`} />
        <Stat label={t("stats.bookings")} value={g.bookings} />
        <Stat label={t("stats.latency")} value={`${data.platform.latencyMs} ms`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("stats.demand")} value={`${Math.round(g.demand * 100)}%`} />
        <Stat label={t("stats.supply")} value={`${Math.round(g.supply * 100)}%`} />
        <Stat label={t("stats.completion")} value={`${Math.round(g.completionRate * 100)}%`} />
        <Stat label={t("stats.satisfaction")} value={`${Math.round(g.customerSatisfaction * 100)}%`} />
      </div>

      <section className="rounded-2xl border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("executive.title")}
        </h2>
        <p className="text-sm">{report.summaryEn}</p>
        <p className="text-xs text-muted-foreground">
          {t("executive.trend")}: {report.trendDirection} · {t("executive.confidence")}:{" "}
          {Math.round(report.confidence * 100)}%
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {report.recommendedActions.slice(0, 4).map((a) => (
            <li key={a} className="rounded-xl border px-3 py-2">
              {a}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("kpis.title")}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Kpi label={t("kpis.growth")} value={g.marketplaceGrowth} />
          <Kpi label={t("kpis.acceptance")} value={g.acceptanceRate} />
          <Kpi label={t("kpis.cancellation")} value={g.cancellationRate} />
          <Kpi label={t("kpis.trust")} value={g.trustDistribution} />
          <Kpi label={t("kpis.fraud")} value={g.fraudTrends} />
          <Kpi label={t("kpis.quality")} value={g.qualityTrends} />
          <Kpi label={t("kpis.pricing")} value={g.pricingTrends} />
          <Kpi label={t("kpis.forecast")} value={g.forecastAccuracy} />
          <Kpi label={t("kpis.scheduling")} value={g.schedulingEfficiency} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("opportunities.title")}
        </h2>
        {data.platform.opportunities.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("opportunities.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.platform.opportunities.slice(0, 6).map((o) => (
              <li key={o.code} className="rounded-xl border px-3 py-2 text-sm">
                <span className="font-medium">{o.titleEn}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · score {Math.round(o.score * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("regions.title")}
        </h2>
        {data.platform.regions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("regions.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.platform.regions.slice(0, 6).map((r) => (
              <li key={r.regionKey} className="rounded-xl border px-3 py-2 text-sm">
                {r.summaryEn}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("categories.title")}
        </h2>
        {data.platform.categories.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("categories.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.platform.categories.slice(0, 6).map((c) => (
              <li key={c.categoryKey} className="rounded-xl border px-3 py-2 text-sm">
                {c.summaryEn}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("decisions.title")}
        </h2>
        <ul className="mt-3 space-y-2">
          {data.platform.decisions.slice(0, 5).map((d) => (
            <li key={d.code} className="rounded-xl border px-3 py-2 text-sm space-y-1">
              <p className="font-medium">{d.titleEn}</p>
              <p className="text-muted-foreground">{d.reasonEn}</p>
              <p className="text-xs text-muted-foreground">
                ROI {d.estimatedRoi}x · {d.estimatedTime} · {t("decisions.confidence")}{" "}
                {Math.round(d.confidence * 100)}% · {d.requiredEffort}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("simulation.title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("simulation.notice")}</p>
        <Button
          size="sm"
          disabled={pending}
          className="rounded-xl"
          onClick={() =>
            start(async () => {
              await runMarketplaceSimulationAction({
                title: "Increase provider count +15",
                scenarioType: "provider_count",
                inputs: { providerDelta: 15 },
              });
              router.refresh();
            })
          }
        >
          {t("simulation.run")}
        </Button>
        <ul className="space-y-2 text-sm">
          {data.platform.simulations.slice(0, 4).map((s) => (
            <li key={s.title} className="rounded-xl border px-3 py-2">
              {s.impactSummaryEn}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("modules.title")}
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          {data.modules.map((m) => (
            <li key={m.key} className="rounded-xl border px-3 py-2 flex justify-between gap-2">
              <span>
                {m.key} · {m.kind} · {m.version}
              </span>
              <span className="text-muted-foreground">
                {m.enabled ? t("modules.on") : t("modules.off")}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            className="rounded-xl"
            onClick={() =>
              start(async () => {
                await setMarketplaceMlExperimentAction({
                  active: !(ml?.enabled ?? false),
                });
                router.refresh();
              })
            }
          >
            {ml?.enabled ? t("modules.disableMl") : t("modules.enableMl")}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("agents.title")}
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.platform.agents.map((a) => (
            <li key={a.id} className="rounded-xl border px-3 py-2">
              {a.name} — {a.scope}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">{t("agents.notice")}</p>
      </section>

      <p className="text-xs text-muted-foreground">
        {t("meta.reports")}: {data.persistedReports} · {t("meta.simulations")}:{" "}
        {data.persistedSimulations} · {t("meta.version")}: {data.algorithmVersion}
      </p>
      <p className="text-xs text-muted-foreground">{data.platform.advisoryNotice}</p>
      <p className="text-xs text-muted-foreground">{t("privacy")}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border px-3 py-2 flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{Math.round(value * 100)}%</span>
    </div>
  );
}
