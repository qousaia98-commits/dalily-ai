import { getTranslations } from "next-intl/server";
import type { MarketplaceInsights } from "@/lib/admin/marketplace-insights";

export async function ControlCenterMarketplace({
  insights,
}: {
  insights: MarketplaceInsights;
}) {
  const t = await getTranslations("admin.controlCenter.marketplace");

  return (
    <section className="space-y-4" aria-labelledby="marketplace-title">
      <div>
        <h2 id="marketplace-title" className="text-lg font-bold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("searches")} value={String(insights.totalSearches)} />
        <Metric label={t("impressions")} value={String(insights.searchImpressions)} />
        <Metric label={t("conversions")} value={String(insights.conversions)} />
        <Metric
          label={t("avgDistance")}
          value={
            insights.averageCustomerDistanceKm != null
              ? `${insights.averageCustomerDistanceKm} km`
              : "—"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title={t("topCategories")}
          empty={t("empty")}
          items={insights.topCategories.map((c) => ({
            label: c.slug,
            value: String(c.count),
          }))}
        />
        <ListCard
          title={t("topCities")}
          empty={t("empty")}
          items={insights.topCities.map((c) => ({
            label: c.slug,
            value: String(c.count),
          }))}
        />
        <ListCard
          title={t("mostViewed")}
          empty={t("empty")}
          items={insights.mostViewedBusinesses.map((b) => ({
            label: b.providerId.slice(0, 8),
            value: String(b.views),
          }))}
        />
        <ListCard
          title={t("mostActive")}
          empty={t("empty")}
          items={insights.mostActiveBusinesses.map((b) => ({
            label: b.providerId.slice(0, 8),
            value: String(b.events),
          }))}
        />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ListCard({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.label + item.value}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="font-semibold text-foreground">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
