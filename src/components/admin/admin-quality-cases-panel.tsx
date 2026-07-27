"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  assignQualityCaseAction,
  transitionQualityCaseAction,
  mergeQualityCasesAction,
} from "@/actions/quality.actions";
import type { AdminQualityDashboard } from "@/lib/quality/queries";
import type { QualityCaseStatus } from "@/lib/quality/types";
import { QUALITY_CASE_STATUSES } from "@/lib/quality/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";
import { formatDateTime } from "@/lib/format/datetime";

type Props = { data: AdminQualityDashboard };

export function AdminQualityCasesPanel({ data }: Props) {
  const t = useTranslations("admin.quality");
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("stats.open")} value={data.openCount} />
        <Stat label={t("stats.escalated")} value={data.escalatedCount} />
        <Stat label={t("stats.resolvedWeek")} value={data.resolvedThisWeek} />
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("byCategory")}
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {Object.entries(data.byCategory).map(([k, v]) => (
            <li key={k} className="rounded-lg border px-3 py-1 text-sm">
              {t(`categories.${k}` as "categories.other")}: {v}
            </li>
          ))}
        </ul>
      </section>

      <ul className="space-y-3">
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          data.recent.map((item) => (
            <li key={item.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">
                    {item.caseNumber} · {t(`statuses.${item.status}`)} ·{" "}
                    {t(`priorities.${item.priority}`)}
                  </p>
                  <p className="text-sm">{item.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`categories.${item.category}`)} · {formatDateTime(item.createdAt)}
                    {item.providerId ? (
                      <>
                        {" · "}
                        <Link
                          href={`/admin/providers/${item.providerId}`}
                          className="underline"
                        >
                          {t("provider")}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(() => assignQualityCaseAction({ caseId: item.id }))
                    }
                  >
                    {t("actions.assign")}
                  </Button>
                  <select
                    className="h-9 rounded-lg border bg-background px-2 text-xs"
                    disabled={pending}
                    defaultValue=""
                    onChange={(e) => {
                      const to = e.target.value as QualityCaseStatus;
                      if (!to) return;
                      run(() =>
                        transitionQualityCaseAction({
                          caseId: item.id,
                          toStatus: to,
                        }),
                      );
                      e.target.value = "";
                    }}
                  >
                    <option value="">{t("actions.changeStatus")}</option>
                    {QUALITY_CASE_STATUSES.map((s) => (
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
                        transitionQualityCaseAction({
                          caseId: item.id,
                          toStatus: "escalated",
                          note: "Escalated from admin panel",
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
                        transitionQualityCaseAction({
                          caseId: item.id,
                          toStatus: "resolved",
                          resolutionSummary: "Resolved by admin",
                        }),
                      )
                    }
                  >
                    {t("actions.resolve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(t("actions.rejectConfirm"))) return;
                      run(() =>
                        transitionQualityCaseAction({
                          caseId: item.id,
                          toStatus: "rejected",
                          resolutionSummary: "Rejected by admin",
                        }),
                      );
                    }}
                  >
                    {t("actions.reject")}
                  </Button>
                  {data.recent[0] && data.recent[0].id !== item.id ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          mergeQualityCasesAction({
                            sourceCaseId: item.id,
                            targetCaseId: data.recent[0].id,
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
