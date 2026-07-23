import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import {
  getPlatformAnalyticsSnapshot,
  getExtendedSearchAnalytics,
} from "@/lib/admin/control-center-v2";
import { getMarketplaceStats } from "@/lib/admin/marketplace-stats";
import { Link } from "@/lib/i18n/routing";

export default async function AdminAnalyticsPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.analyticsCenter");
  const [platform, search, marketplace] = await Promise.all([
    getPlatformAnalyticsSnapshot(),
    getExtendedSearchAnalytics(),
    getMarketplaceStats(),
  ]);

  const kpis = [
    { key: "bookingsTotal", value: platform.bookingsTotal },
    { key: "bookingsMonth", value: platform.bookingsMonth },
    { key: "chatsActive", value: platform.chatsActive },
    { key: "reviewsTotal", value: platform.reviewsTotal },
    { key: "searchesMonth", value: platform.searchesMonth },
    { key: "completionRate", value: `${platform.completionRate}%` },
    { key: "cancellationRate", value: `${platform.cancellationRate}%` },
    { key: "customerGrowth", value: platform.customerGrowthWeek },
    { key: "providerGrowth", value: platform.providerGrowthWeek },
    { key: "acceptanceRate", value: `${marketplace.acceptanceRate}%` },
    { key: "avgRating", value: (marketplace.averageRating ?? 0).toFixed(1) },
    { key: "recClickRate", value: `${search.recommendationClickRate}%` },
  ] as const;

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("exportReady")}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="rounded-2xl border bg-card px-4 py-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`kpis.${kpi.key}`)}
            </p>
            <p className="mt-2 text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/searches" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
          {t("links.searches")}
        </Link>
        <Link href="/admin/marketplace" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
          {t("links.marketplace")}
        </Link>
        <Link href="/admin/learning" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
          {t("links.learning")}
        </Link>
        <Link href="/admin/ranking" className="rounded-lg border px-3 py-1.5 hover:bg-muted">
          {t("links.ranking")}
        </Link>
      </div>
    </div>
  );
}
