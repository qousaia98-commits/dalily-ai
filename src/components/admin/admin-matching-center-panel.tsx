"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  setMatchingExperimentAction,
  simulateMatchingAction,
  updateMatchingWeightAction,
} from "@/actions/matching.actions";
import type { AdminMatchingDashboard } from "@/domains/matching/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/datetime";

type Props = { data: AdminMatchingDashboard };

export function AdminMatchingCenterPanel({ data }: Props) {
  const t = useTranslations("admin.matching");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [simResult, setSimResult] = useState<string | null>(null);
  const [providerIds, setProviderIds] = useState("");

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("stats.avgLatency")} value={data.avgLatencyMs != null ? `${data.avgLatencyMs} ms` : "—"} />
        <Stat label={t("stats.feedback")} value={data.feedbackStats.total} />
        <Stat label={t("stats.accepted")} value={data.feedbackStats.accepted} />
        <Stat label={t("stats.model")} value={data.modelVersion} />
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("experiment.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("experiment.hint")}</p>
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
                run(() =>
                  setMatchingExperimentAction({
                    active: !data.experiment!.active,
                    trafficBPct: data.experiment!.trafficBPct || 10,
                  }),
                )
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
          {t("weights.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("weights.hint")}</p>
        <ul className="mt-3 space-y-2">
          {data.weights.map((w) => (
            <li
              key={w.signalKey}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {w.signalKey} · {w.category}
                  {w.mlReady ? ` · ${t("weights.mlReady")}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {w.enabled ? t("weights.enabled") : t("weights.disabled")} ·{" "}
                  {t("weights.weight")}: {w.weight}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  defaultValue={w.weight}
                  className="h-9 w-24 rounded-lg"
                  id={`w-${w.signalKey}`}
                />
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    const el = document.getElementById(
                      `w-${w.signalKey}`,
                    ) as HTMLInputElement | null;
                    const weight = Number(el?.value ?? w.weight);
                    run(() =>
                      updateMatchingWeightAction({
                        signalKey: w.signalKey,
                        weight,
                        enabled: w.enabled,
                      }),
                    );
                  }}
                >
                  {t("weights.save")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("simulate.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("simulate.hint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={providerIds}
            onChange={(e) => setProviderIds(e.target.value)}
            placeholder={t("simulate.placeholder")}
            className="max-w-md rounded-xl"
          />
          <Button
            disabled={pending}
            className="rounded-xl"
            onClick={() =>
              start(async () => {
                const ids = providerIds
                  .split(/[,\s]+/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                const res = await simulateMatchingAction({ providerIds: ids });
                if (res.simulation) {
                  setSimResult(
                    JSON.stringify(
                      {
                        latencyMs: res.simulation.latencyMs,
                        public: res.simulation.publicView,
                        adminScores: res.simulation.topInternalScores,
                      },
                      null,
                      2,
                    ),
                  );
                } else {
                  setSimResult(res.error ?? "failed");
                }
              })
            }
          >
            {t("simulate.run")}
          </Button>
        </div>
        {simResult ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            {simResult}
          </pre>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("history.title")}
        </h2>
        <ul className="mt-2 space-y-2">
          {data.recentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
          ) : (
            data.recentHistory.map((h) => (
              <li key={h.id} className="rounded-xl border px-3 py-2 text-sm">
                <p className="font-medium">
                  {h.algorithmVersion} · {h.providerCount} providers ·{" "}
                  {h.latencyMs != null ? `${h.latencyMs} ms` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {h.requestId ?? "—"} · {formatDateTime(h.createdAt)}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("fairness.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("fairness.body")}</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
