import { getTranslations } from "next-intl/server";
import type { ControlCenterOverview } from "@/lib/admin/control-center";
import { cn } from "@/lib/utils";

type Stat = {
  key: string;
  value: string;
  accent?: boolean;
};

export async function ControlCenterStats({ overview }: { overview: ControlCenterOverview }) {
  const t = await getTranslations("admin.controlCenter.stats");

  const stats: Stat[] = [
    { key: "pendingBusinesses", value: String(overview.pendingBusinesses), accent: true },
    { key: "approvedToday", value: String(overview.approvedToday) },
    { key: "changesRequested", value: String(overview.changesRequested) },
    { key: "pendingPayments", value: String(overview.pendingPayments), accent: true },
    {
      key: "revenue",
      value: `$${overview.revenueThisMonthUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
    { key: "starter", value: String(overview.planCounts.starter) },
    { key: "pro", value: String(overview.planCounts.pro) },
    { key: "premium", value: String(overview.planCounts.premium) },
  ];

  return (
    <section className="space-y-4" aria-labelledby="control-stats-title">
      <h2 id="control-stats-title" className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]">
        {t("title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={cn(
              "rounded-3xl border border-[#E8ECF2] bg-white px-4 py-5 shadow-[0_10px_28px_-20px_rgba(11,21,38,0.25)]",
              stat.accent && "border-[var(--dalily-gold)]/35 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)]",
            )}
          >
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t(stat.key)}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--dalily-navy)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
