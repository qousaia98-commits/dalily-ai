"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  replayScheduleHistoryAction,
  setScheduleExperimentAction,
  simulateScheduleAction,
  updateScheduleWeightAction,
} from "@/actions/scheduling.actions";
import type { AdminScheduleDashboard } from "@/lib/scheduling-engine/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/datetime";

type Props = { data: AdminScheduleDashboard };

export function AdminSchedulingCenterPanel({ data }: Props) {
  const t = useTranslations("admin.scheduling");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [simResult, setSimResult] = useState<string | null>(null);
  const [replayResult, setReplayResult] = useState<string | null>(null);
  const [providerId, setProviderId] = useState("");

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
        <Stat
          label={t("stats.utilization")}
          value={
            data.avgUtilization != null
              ? `${Math.round(data.avgUtilization * 100)}%`
              : "—"
          }
        />
        <Stat
          label={t("stats.idle")}
          value={data.avgIdleMinutes != null ? `${data.avgIdleMinutes} m` : "—"}
        />
        <Stat
          label={t("stats.capture")}
          value={
            data.opportunityStats.captureRate != null
              ? `${Math.round(data.opportunityStats.captureRate * 100)}%`
              : "—"
          }
        />
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("profiles.title")}
        </h2>
        <ul className="mt-3 space-y-2">
          {data.profiles.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("profiles.empty")}</li>
          ) : (
            data.profiles.map((p) => (
              <li key={p.profileKey} className="rounded-xl border px-3 py-2 text-sm">
                <span className="font-medium">{p.title}</span> · {p.goal}
                {p.mlReady ? ` · ${t("weights.mlReady")}` : ""}
                {p.isDefault ? ` · ${t("profiles.default")}` : ""}
              </li>
            ))
          )}
        </ul>
      </section>

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
                run(() =>
                  setScheduleExperimentAction({
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
                  {t("weights.weight")}: {w.weight}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.05"
                  defaultValue={w.weight}
                  className="h-9 w-24 rounded-lg"
                  id={`sw-${w.signalKey}`}
                />
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    const el = document.getElementById(
                      `sw-${w.signalKey}`,
                    ) as HTMLInputElement | null;
                    run(() =>
                      updateScheduleWeightAction({
                        signalKey: w.signalKey,
                        weight: Number(el?.value ?? w.weight),
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
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            placeholder={t("simulate.placeholder")}
            className="max-w-md rounded-xl"
          />
          <Button
            disabled={pending}
            className="rounded-xl"
            onClick={() =>
              start(async () => {
                const res = await simulateScheduleAction({ providerId });
                if (res.simulation) {
                  const s = res.simulation;
                  setSimResult(
                    `util ${Math.round(s.utilization * 100)}% · travel ${s.travelMinutes}m · idle ${s.idleMinutes}m · gaps ${s.gaps} · opps ${s.opportunities} · ${s.latencyMs}ms`,
                  );
                } else setSimResult(res.error ?? "error");
              })
            }
          >
            {t("simulate.run")}
          </Button>
        </div>
        {simResult ? <p className="mt-3 text-sm text-muted-foreground">{simResult}</p> : null}
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
                    {h.scheduleDate ?? "—"} · util{" "}
                    {h.utilization != null ? `${Math.round(h.utilization * 100)}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.algorithmVersion} · {formatDateTime(h.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await replayScheduleHistoryAction({
                        historyId: h.id,
                      });
                      setReplayResult(
                        res.replay
                          ? `${JSON.stringify(res.replay.public).slice(0, 180)}…`
                          : (res.error ?? "error"),
                      );
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
          <p className="mt-3 break-all text-sm text-muted-foreground">{replayResult}</p>
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
