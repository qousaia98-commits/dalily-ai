"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setBusinessAssistantExperimentAction } from "@/actions/business-assistant.actions";
import type { AdminBusinessDashboard } from "@/lib/business-assistant/admin";
import { Button } from "@/components/ui/button";

type Props = { data: AdminBusinessDashboard };

export function AdminBusinessAssistantPanel({ data }: Props) {
  const t = useTranslations("admin.businessAssistant");
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("stats.providers")} value={data.providerGrowthCount} />
        <Stat label={t("stats.briefings")} value={data.recentBriefings} />
        <Stat label={t("stats.healthy")} value={data.healthDistribution.healthy} />
        <Stat label={t("stats.atRisk")} value={data.healthDistribution.atRisk} />
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("experiment.title")}
        </h2>
        {data.experiment ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span>
              A: {data.experiment.algorithmA} · B: {data.experiment.algorithmB} ·{" "}
              {data.experiment.trafficBPct}% B ·{" "}
              {data.experiment.active ? t("experiment.active") : t("experiment.inactive")}
            </span>
            <Button
              size="sm"
              disabled={pending}
              className="rounded-xl"
              onClick={() =>
                start(async () => {
                  await setBusinessAssistantExperimentAction({
                    active: !data.experiment!.active,
                    trafficBPct: data.experiment!.trafficBPct || 10,
                  });
                  router.refresh();
                })
              }
            >
              {data.experiment.active ? t("experiment.disable") : t("experiment.enable")}
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("experiment.empty")}</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("regions.title")}
        </h2>
        {data.regionalOpportunities.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("regions.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.regionalOpportunities.map((r) => (
              <li key={r.regionKey} className="rounded-xl border px-3 py-2 text-sm">
                {r.regionKey} · demand {r.demandIndex}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("categories.title")}
        </h2>
        {data.categoryOpportunities.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("categories.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.categoryOpportunities.map((c) => (
              <li
                key={`${c.categoryKey}-${c.demandIndex}`}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                {c.categoryKey} · demand {c.demandIndex}
              </li>
            ))}
          </ul>
        )}
      </section>

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
