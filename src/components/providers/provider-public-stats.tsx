import { getTranslations } from "next-intl/server";
import type { PublicProviderStats } from "@/lib/providers/public-profile";

export async function ProviderPublicStatsGrid({
  stats,
  showCompletedJobs,
}: {
  stats: PublicProviderStats;
  showCompletedJobs?: boolean;
}) {
  const t = await getTranslations("provider.publicStats");

  const items: { label: string; value: string }[] = [
    ...(showCompletedJobs !== false
      ? [
          {
            label: t("completedJobs"),
            value: String(stats.completedJobs),
          },
        ]
      : []),
    {
      label: t("successRate"),
      value:
        stats.successRatePct != null ? t("pct", { value: stats.successRatePct }) : "—",
    },
    {
      label: t("acceptanceRate"),
      value:
        stats.acceptanceRatePct != null
          ? t("pct", { value: stats.acceptanceRatePct })
          : "—",
    },
    {
      label: t("repeatCustomers"),
      value:
        stats.repeatCustomersPct != null
          ? t("pct", { value: stats.repeatCustomersPct })
          : "—",
    },
    {
      label: t("responseRate"),
      value:
        stats.responseRatePct != null
          ? t("pct", { value: stats.responseRatePct })
          : "—",
    },
    {
      label: t("avgResponse"),
      value:
        stats.avgResponseHours != null
          ? t("hours", { hours: stats.avgResponseHours })
          : "—",
    },
    {
      label: t("reliability"),
      value:
        stats.reliabilityScorePct != null
          ? t("pct", { value: stats.reliabilityScorePct })
          : "—",
    },
    {
      label: t("profileCompletion"),
      value: t("pct", { value: stats.profileCompletionPct }),
    },
    {
      label: t("yearsOnDalily"),
      value:
        stats.yearsOnDalily <= 0
          ? t("lessThanYear")
          : t("years", { count: stats.yearsOnDalily }),
    },
  ];

  return (
    <section id="provider-stats">
      <h2 className="mb-3 text-lg font-semibold">{t("title")}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/35"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
