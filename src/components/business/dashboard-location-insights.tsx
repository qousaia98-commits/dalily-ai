import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { LocationInsights } from "@/lib/business/insights";
import { getBenefits } from "@/lib/subscription/benefit-engine";
import type { PlanSlug } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

export async function DashboardLocationInsights({
  insights,
  planSlug,
}: {
  insights: LocationInsights;
  planSlug: PlanSlug;
}) {
  const t = await getTranslations("business.locationInsights");
  const benefits = getBenefits(planSlug);
  const showPremium = benefits.canViewVisitorCities || benefits.canAccessAdvancedInsights;

  const items = [
    {
      label: t("topArea"),
      value: insights.topVisitorArea,
    },
    {
      label: t("avgDistance"),
      value:
        insights.averageCustomerDistanceKm != null
          ? t("kmValue", { km: insights.averageCustomerDistanceKm })
          : t("unavailable"),
    },
    {
      label: t("nearbyWeek"),
      value: String(insights.nearbySearchesThisWeek),
    },
  ];

  if (showPremium) {
    items.push({
      label: t("peakDay"),
      value: insights.peakSearchDay ?? t("unavailable"),
    });
    if (insights.citySharePercent != null) {
      items.push({
        label: t("cityShare"),
        value: `${insights.citySharePercent}%`,
      });
    }
  }

  return (
    <section
      className="space-y-4 overflow-x-hidden"
      aria-labelledby="location-insights-title"
    >
      <div className="flex items-center gap-2">
        <MapPin className="size-5 text-[var(--dalily-gold)]" aria-hidden />
        <h2 id="location-insights-title" className="text-lg font-bold text-foreground">
          {t("title")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.label}
            className={cn(
              "rounded-2xl border border-border bg-card px-4 py-3",
              "focus-within:ring-2 focus-within:ring-[var(--dalily-gold)]",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">{item.value}</p>
          </li>
        ))}
      </ul>
      {showPremium ? (
        <p className="text-xs text-muted-foreground">{t("premiumNote")}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("upgradeHint")}</p>
      )}
    </section>
  );
}
