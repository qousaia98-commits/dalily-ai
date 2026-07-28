"use client";

import { useTranslations } from "next-intl";
import type { AdminReputationDashboard } from "@/lib/reputation/admin";
import { Link } from "@/lib/i18n/navigation";

type Props = { data: AdminReputationDashboard };

export function AdminReputationDashboardPanel({ data }: Props) {
  const t = useTranslations("admin.reputation");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("distribution")}
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(data.distribution) as Array<keyof typeof data.distribution>).map(
            (level) => (
              <li key={level} className="rounded-lg border px-3 py-1.5 text-sm">
                {t(`levels.${level}`)}:{" "}
                <span className="font-semibold tabular-nums">{data.distribution[level]}</span>
              </li>
            ),
          )}
        </ul>
      </section>

      <Section title={t("highest")} rows={data.highest} t={t} />
      <Section title={t("rising")} rows={data.rising} t={t} />
      <Section title={t("declining")} rows={data.declining} t={t} />
      <Section title={t("needsReview")} rows={data.needsReview} t={t} />
      <Section title={t("complaintHeavy")} rows={data.complaintHeavy} t={t} />
    </div>
  );
}

function Section({
  title,
  rows,
  t,
}: {
  title: string;
  rows: AdminReputationDashboard["highest"];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {rows.map((row) => (
            <li
              key={row.providerId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <Link
                  href={`/admin/providers/${row.providerId}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {row.businessName || row.providerId.slice(0, 8)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t(`levels.${row.trustLevel}`)} · {t(`trend.${row.trend}`)} ·{" "}
                  {t("internalScore")}: {row.internalScore.toFixed(1)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                search {row.searchBoost.toFixed(2)} · rec{" "}
                {row.recommendationBoost.toFixed(2)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
