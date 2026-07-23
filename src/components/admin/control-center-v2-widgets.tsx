import { getTranslations } from "next-intl/server";
import type { ControlCenterV2Kpis } from "@/lib/admin/control-center-v2";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/i18n/routing";

type Props = { kpis: ControlCenterV2Kpis };

export async function ControlCenterV2Widgets({ kpis }: Props) {
  const t = await getTranslations("admin.controlCenterV2");

  const primary = [
    { key: "totalUsers", value: kpis.totalUsers },
    { key: "totalProviders", value: kpis.totalProviders },
    { key: "verifiedProviders", value: kpis.verifiedProviders },
    { key: "pendingVerifications", value: kpis.pendingVerifications, href: "/admin/verification", accent: true },
    { key: "bookingsToday", value: kpis.bookingsToday },
    { key: "bookingsThisMonth", value: kpis.bookingsThisMonth },
    { key: "completedJobs", value: kpis.completedJobs },
    { key: "activeConversations", value: kpis.activeConversations },
    { key: "averageRating", value: kpis.averageRating.toFixed(1) },
    { key: "averageDalilyScore", value: kpis.averageDalilyScore },
    { key: "issueReports", value: kpis.issueReports, href: "/admin/issues", accent: true },
    { key: "openModeration", value: kpis.openModerationItems, href: "/admin/issues", accent: true },
    { key: "searchesToday", value: kpis.searchesToday, href: "/admin/searches" },
    { key: "searchSuccessRate", value: `${kpis.searchSuccessRate}%` },
  ] as const;

  return (
    <section className="space-y-6" aria-labelledby="cc-v2-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="cc-v2-title" className="text-xl font-bold tracking-tight text-[var(--dalily-navy)] dark:text-foreground">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/admin/analytics" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
            {t("links.analytics")}
          </Link>
          <Link href="/admin/health" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
            {t("links.health")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {primary.map((stat) => {
          const card = (
            <div
              className={cn(
                "rounded-2xl border border-border bg-card px-4 py-4 shadow-sm transition-colors",
                "accent" in stat && stat.accent && "border-[var(--dalily-gold)]/40 bg-[linear-gradient(180deg,var(--card)_0%,rgba(212,175,55,0.06)_100%)]",
                "href" in stat && stat.href && "hover:border-[var(--dalily-gold)]/60",
              )}
            >
              <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                {t(`kpis.${stat.key}`)}
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight">{stat.value}</p>
            </div>
          );
          return "href" in stat && stat.href ? (
            <Link key={stat.key} href={stat.href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {card}
            </Link>
          ) : (
            <div key={stat.key}>{card}</div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("topCategories")}</h3>
          <ul className="mt-3 space-y-2">
            {kpis.topCategories.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t("empty")}</li>
            ) : (
              kpis.topCategories.map((c) => (
                <li key={c.id} className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("topCities")}</h3>
          <ul className="mt-3 space-y-2">
            {kpis.topCities.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t("empty")}</li>
            ) : (
              kpis.topCities.map((c) => (
                <li key={c.id} className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
