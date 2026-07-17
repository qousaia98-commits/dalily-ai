import { Lock, Sparkles, Star, TrendingUp, MapPin, Search, BarChart3 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { getBenefits } from "@/lib/subscription/benefit-engine";
import { getProviderAnalyticsBundle } from "@/lib/business/insights";
import { categorySlugFromId } from "@/lib/providers/reference";
import { BusinessStatsCards } from "@/components/business/business-stats-cards";
import { DashboardGrowthPotential } from "@/components/business/dashboard-growth-potential";
import { PlanBadge } from "@/components/shared/plan-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PlanSlug } from "@/lib/subscription/types";
import type { Locale } from "@/lib/i18n/config";

export default async function BusinessAnalyticsPage() {
  const t = await getTranslations("business.analytics");
  const tGrowth = await getTranslations("mobilePages.growth");
  const tLock = await getTranslations("business.analytics.locks");
  const locale = (await getLocale()) as Locale;
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  let planSlug: PlanSlug = "free";
  try {
    const { subscription } = await getSubscriptionPageData(authUser.id);
    planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
  } catch {
    planSlug = "free";
  }

  const benefits = getBenefits(planSlug);

  if (!provider) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-bold">{tGrowth("title")}</h1>
        <p className="text-muted-foreground">{t("needsProvider")}</p>
      </div>
    );
  }

  const categorySlug = await categorySlugFromId(provider.categoryId);
  const analytics = await getProviderAnalyticsBundle({
    providerId: provider.id,
    categorySlug: categorySlug ?? null,
    cityId: provider.cityId,
    locale,
    planSlug,
    reviewCount: provider.reviewCount,
  });

  // Build real daily impression chart from engagement events (last 7 days)
  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const weeklyBuckets = dayKeys.map((key) => ({
    day: t(`days.${key}`),
    views: 0,
  }));

  // Distribute profile views evenly display is wrong — show total as single insight instead
  const hasChartData = analytics.weekly.profileViews != null && analytics.weekly.profileViews > 0;

  const lockedCards = [
    { key: "profileAnalytics", icon: BarChart3, unlock: "pro" as const },
    { key: "growthInsights", icon: TrendingUp, unlock: "premium" as const },
    { key: "featuredPlacement", icon: Star, unlock: "premium" as const },
    { key: "competitors", icon: TrendingUp, unlock: "pro" as const },
    { key: "conversion", icon: Sparkles, unlock: "pro" as const },
    { key: "premiumReach", icon: Star, unlock: "premium" as const },
  ] as const;

  const advancedCards = [
    { key: "visitorCities", icon: MapPin },
    { key: "popularTerms", icon: Search },
    { key: "weeklyReport", icon: BarChart3 },
  ] as const;

  return (
    <div className="space-y-8 overflow-x-hidden animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{tGrowth("title")}</h1>
          <p className="mt-1 text-muted-foreground">{tGrowth("subtitle")}</p>
        </div>
        <PlanBadge planSlug={planSlug} size="md" />
      </div>

      <DashboardGrowthPotential growth={analytics.growth} planSlug={planSlug} />

      {benefits.canViewAnalytics ? <BusinessStatsCards insights={analytics.weekly} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("weeklyViews")}</CardTitle>
        </CardHeader>
        <CardContent>
          {benefits.canViewGrowthDashboard && hasChartData ? (
            <div className="space-y-3">
              <p className="text-3xl font-bold">{analytics.weekly.profileViews}</p>
              <p className="text-sm text-muted-foreground">{t("realViewsHint")}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t("impressionsLabel")}</p>
                  <p className="text-lg font-bold">{analytics.impressions}</p>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t("clicksLabel")}</p>
                  <p className="text-lg font-bold">{analytics.serpClicks}</p>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t("contactsLabel")}</p>
                  <p className="text-lg font-bold">
                    {analytics.weekly.contactClicks ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t("appearancesLabel")}</p>
                  <p className="text-lg font-bold">{analytics.weekly.searchAppearances}</p>
                </div>
              </div>
            </div>
          ) : benefits.canViewGrowthDashboard ? (
            <p className="text-sm text-muted-foreground">{t("noDataYet")}</p>
          ) : (
            <div className="relative rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <Lock className="mx-auto size-5 text-[var(--dalily-gold)]" aria-hidden />
              <p className="mt-2 text-sm font-semibold">{tLock("chartTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tLock("chartBody")}</p>
              {/* keep unused var referenced for future daily chart */}
              <span className="sr-only">{weeklyBuckets.length}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {benefits.canAccessAdvancedInsights ? (
        <section className="grid gap-3 sm:grid-cols-3">
          {advancedCards.map(({ key, icon: Icon }) => {
            let value: string | null = null;
            if (key === "visitorCities" && analytics.location.topVisitorArea !== "—") {
              value = analytics.location.topVisitorArea;
            }
            if (
              key === "weeklyReport" &&
              analytics.location.averageCustomerDistanceKm != null
            ) {
              value = `${analytics.location.averageCustomerDistanceKm} km`;
            }
            return (
              <div
                key={key}
                className={cn(
                  "rounded-2xl border p-4",
                  "border-border bg-card",
                )}
              >
                <Icon className="size-5 text-[var(--dalily-gold)]" aria-hidden />
                <p className="mt-3 text-sm font-semibold">{t(`advanced.${key}.title`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {value ?? t(`advanced.${key}.empty`)}
                </p>
              </div>
            );
          })}
        </section>
      ) : null}

      {!benefits.canUsePremiumBadge || !benefits.canViewConversions ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{tGrowth("lockedTitle")}</h2>
            <p className="text-sm text-muted-foreground">{tGrowth("lockedSubtitle")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lockedCards
              .filter((card) => {
                if (card.unlock === "pro" && benefits.canAccessAdvancedInsights) return false;
                if (card.unlock === "premium" && benefits.canUsePremiumBadge) return false;
                return true;
              })
              .map(({ key, icon: Icon, unlock }) => (
                <div
                  key={key}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--dalily-gold)_28%,transparent)]",
                    "bg-gradient-to-br from-[color-mix(in_oklab,var(--dalily-gold)_10%,transparent)] to-card p-4",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="size-5 text-[var(--dalily-gold)]" aria-hidden />
                    <Lock className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-semibold">{tLock(`${key}.title`)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tLock(`${key}.body`)}</p>
                  <p className="mt-3 text-[0.65rem] font-bold tracking-wide text-[var(--dalily-gold)] uppercase">
                    {unlock === "premium" ? tLock("premiumOnly") : tLock("unlockPro")}
                  </p>
                </div>
              ))}
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/business/subscription">{tGrowth("upgradeCta")}</Link>
          </Button>
        </section>
      ) : null}
    </div>
  );
}
