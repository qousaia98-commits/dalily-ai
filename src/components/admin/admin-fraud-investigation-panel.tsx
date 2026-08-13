"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  assignInvestigationAction,
  createInvestigationAction,
  markFalsePositiveAction,
  mergeInvestigationsAction,
  recalculateRiskAction,
  transitionInvestigationAction,
} from "@/actions/fraud.actions";
import type { AdminFraudDashboard } from "@/lib/fraud/queries";
import { INVESTIGATION_STATUSES, type InvestigationStatus } from "@/lib/fraud/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/datetime";
import { FraudRelationshipGraph } from "@/components/admin/fraud-relationship-graph";

type Props = { data: AdminFraudDashboard };

export function AdminFraudInvestigationPanel({ data }: Props) {
  const t = useTranslations("admin.fraud");
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("stats.open")} value={data.openInvestigations} />
        <Stat label={t("stats.escalated")} value={data.escalatedInvestigations} />
        <Stat label={t("stats.highRisk")} value={data.highRiskEntities} />
        <Stat label={t("stats.eventsToday")} value={data.eventsToday} />
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("recalculate.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("recalculate.hint")}</p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const entityType = String(fd.get("entityType") || "provider") as
              | "provider"
              | "customer";
            const entityId = String(fd.get("entityId") || "").trim();
            if (!entityId) return;
            run(() => recalculateRiskAction({ entityType, entityId }));
          }}
        >
          <select
            name="entityType"
            className="h-10 rounded-xl border bg-background px-3 text-sm"
            defaultValue="provider"
          >
            <option value="provider">{t("entities.provider")}</option>
            <option value="customer">{t("entities.customer")}</option>
          </select>
          <Input
            name="entityId"
            placeholder={t("recalculate.entityId")}
            className="max-w-xs rounded-xl"
            required
          />
          <Button type="submit" disabled={pending} className="rounded-xl">
            {t("recalculate.submit")}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("riskScores")}
        </h2>
        <ul className="mt-2 space-y-2">
          {data.topRiskScores.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyScores")}</p>
          ) : (
            data.topRiskScores.map((s) => (
              <li
                key={`${s.entityType}:${s.entityId}`}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {s.entityType}:{s.entityId.slice(0, 8)}… ·{" "}
                    {t(`levels.${s.riskLevel}`)} · {s.internalScore}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        createInvestigationAction({
                          title: `Investigate ${s.entityType} risk`,
                          entityType: s.entityType,
                          entityId: s.entityId,
                          priority:
                            s.riskLevel === "critical" || s.riskLevel === "high"
                              ? "high"
                              : "medium",
                        }),
                      )
                    }
                  >
                    {t("actions.investigate")}
                  </Button>
                </div>
                {s.explanation ? (
                  <p className="mt-1 text-xs text-muted-foreground">{s.explanation}</p>
                ) : null}
                {s.triggeredRules.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("triggered")}: {s.triggeredRules.join(", ")}
                  </p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("investigations")}
        </h2>
        <ul className="mt-2 space-y-3">
          {data.recentInvestigations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyInvestigations")}</p>
          ) : (
            data.recentInvestigations.map((inv) => (
              <li key={inv.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">
                      {inv.caseNumber} · {t(`statuses.${inv.status}`)} ·{" "}
                      {t(`priorities.${inv.priority}`)}
                    </p>
                    <p className="text-sm">{inv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.primaryEntityType}:{inv.primaryEntityId} ·{" "}
                      {formatDateTime(inv.createdAt)}
                    </p>
                    <FraudRelationshipGraph
                      entityType={inv.primaryEntityType}
                      entityId={inv.primaryEntityId}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          assignInvestigationAction({ investigationId: inv.id }),
                        )
                      }
                    >
                      {t("actions.assign")}
                    </Button>
                    <select
                      className="h-9 rounded-lg border bg-background px-2 text-xs"
                      disabled={pending}
                      defaultValue=""
                      onChange={(e) => {
                        const to = e.target.value as InvestigationStatus;
                        if (!to) return;
                        run(() =>
                          transitionInvestigationAction({
                            investigationId: inv.id,
                            toStatus: to,
                          }),
                        );
                        e.target.value = "";
                      }}
                    >
                      <option value="">{t("actions.changeStatus")}</option>
                      {INVESTIGATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`statuses.${s}`)}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          transitionInvestigationAction({
                            investigationId: inv.id,
                            toStatus: "escalated",
                            note: "Escalated from investigation center",
                          }),
                        )
                      }
                    >
                      {t("actions.escalate")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          transitionInvestigationAction({
                            investigationId: inv.id,
                            toStatus: "resolved",
                            outcome: "Resolved by admin",
                          }),
                        )
                      }
                    >
                      {t("actions.resolve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          transitionInvestigationAction({
                            investigationId: inv.id,
                            toStatus: "false_positive",
                            outcome: "Marked false positive",
                          }),
                        )
                      }
                    >
                      {t("actions.falsePositive")}
                    </Button>
                    {data.recentInvestigations[0]?.id !== inv.id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            mergeInvestigationsAction({
                              sourceId: inv.id,
                              targetId: data.recentInvestigations[0].id,
                            }),
                          )
                        }
                      >
                        {t("actions.mergeIntoNewest")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("events")}
        </h2>
        <ul className="mt-2 space-y-2">
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyEvents")}</p>
          ) : (
            data.recentEvents.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {e.title} · {t(`levels.${e.severity}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.eventType} · {e.entityType}:{e.entityId.slice(0, 8)}… ·{" "}
                    {formatDateTime(e.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => markFalsePositiveAction({ eventId: e.id }))}
                >
                  {t("actions.falsePositive")}
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
