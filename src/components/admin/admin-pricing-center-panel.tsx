"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  refreshPricingMarketAction,
  replayPricingHistoryAction,
  setPricingExperimentAction,
  simulatePricingAction,
  updatePricingWeightAction,
} from "@/actions/pricing.actions";
import type { AdminPricingDashboard } from "@/lib/pricing-engine/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/datetime";

type Props = { data: AdminPricingDashboard };

export function AdminPricingCenterPanel({ data }: Props) {
  const t = useTranslations("admin.pricing");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [simResult, setSimResult] = useState<string | null>(null);
  const [replayResult, setReplayResult] = useState<string | null>(null);
  const [categoryKey, setCategoryKey] = useState("plumbing");
  const [distanceKm, setDistanceKm] = useState("8");

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("stats.avgLatency")}
          value={data.avgLatencyMs != null ? `${data.avgLatencyMs} ms` : "—"}
        />
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
                  setPricingExperimentAction({
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("weights.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("weights.hint")}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            className="rounded-xl"
            onClick={() => run(() => refreshPricingMarketAction())}
          >
            {t("market.refresh")}
          </Button>
        </div>
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
                  step="0.05"
                  defaultValue={w.weight}
                  className="h-9 w-24 rounded-lg"
                  id={`pw-${w.signalKey}`}
                />
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    const el = document.getElementById(
                      `pw-${w.signalKey}`,
                    ) as HTMLInputElement | null;
                    const weight = Number(el?.value ?? w.weight);
                    run(() =>
                      updatePricingWeightAction({
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
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            placeholder={t("simulate.category")}
            className="max-w-xs rounded-xl"
          />
          <Input
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            placeholder={t("simulate.distance")}
            type="number"
            className="w-28 rounded-xl"
          />
          <Button
            disabled={pending}
            className="rounded-xl"
            onClick={() =>
              start(async () => {
                const res = await simulatePricingAction({
                  categoryKey,
                  distanceKm: Number(distanceKm) || undefined,
                  urgency01: 0.3,
                  largeProject: false,
                });
                if (res.simulation) {
                  const p = res.simulation.public;
                  setSimResult(
                    `${p.suggestedMin}–${p.suggestedPremium} (avg ${p.suggestedAvg}) · ${p.marketPosition} · ${res.simulation.latencyMs}ms · ${p.explanations.map((e) => e.labelEn).join(" ")}`,
                  );
                } else {
                  setSimResult(res.error ?? "error");
                }
              })
            }
          >
            {t("simulate.run")}
          </Button>
        </div>
        {simResult ? (
          <p className="mt-3 text-sm text-muted-foreground">{simResult}</p>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("market.title")}
        </h2>
        {data.marketSnapshots.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("market.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.marketSnapshots.map((m) => (
              <li
                key={`${m.categoryKey}-${m.regionKey}-${m.computedAt}`}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {m.categoryKey} · {m.regionKey}
                </p>
                <p className="text-xs text-muted-foreground">
                  avg {m.avgPrice ?? "—"} · demand {m.demandIndex} · n=
                  {m.sampleCount}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("history.title")}
        </h2>
        {data.recentHistory.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.recentHistory.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {h.categoryKey ?? "—"} · {h.suggestedMin}–{h.suggestedPremium}{" "}
                    (avg {h.suggestedAvg})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.algorithmVersion} · {h.latencyMs ?? "—"} ms ·{" "}
                    {formatDateTime(h.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await replayPricingHistoryAction({
                        historyId: h.id,
                      });
                      if (res.replay) {
                        setReplayResult(
                          `${JSON.stringify(res.replay.public)} · signals=${Object.keys(res.replay.signalBreakdown).length}`,
                        );
                      } else {
                        setReplayResult(res.error ?? "error");
                      }
                    })
                  }
                >
                  {t("history.replay")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {replayResult ? (
          <p className="mt-3 text-sm text-muted-foreground break-all">{replayResult}</p>
        ) : null}
      </section>
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
