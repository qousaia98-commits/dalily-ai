import { Lock, Sparkles, Star, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { requireAuthUser } from "@/lib/auth/session";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { BusinessStatsCards } from "@/components/business/business-stats-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function BusinessAnalyticsPage() {
  const t = await getTranslations("business.analytics");
  const tGrowth = await getTranslations("mobilePages.growth");
  const authUser = await requireAuthUser();

  let planSlug = "free";
  try {
    const { subscription } = await getSubscriptionPageData(authUser.id);
    planSlug = subscription?.planSlug ?? "free";
  } catch {
    planSlug = "free";
  }
  const isStarter = planSlug === "free";

  const weeklyData = [
    { day: t("days.mon"), views: 142 },
    { day: t("days.tue"), views: 198 },
    { day: t("days.wed"), views: 167 },
    { day: t("days.thu"), views: 221 },
    { day: t("days.fri"), views: 189 },
    { day: t("days.sat"), views: 256 },
    { day: t("days.sun"), views: 174 },
  ];

  const maxViews = Math.max(...weeklyData.map((d) => d.views));

  const lockedCards = [
    { key: "competitors", icon: TrendingUp },
    { key: "conversion", icon: Sparkles },
    { key: "premiumReach", icon: Star },
  ] as const;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{tGrowth("title")}</h1>
        <p className="mt-1 text-muted-foreground">{tGrowth("subtitle")}</p>
      </div>

      <BusinessStatsCards />

      <Card>
        <CardHeader>
          <CardTitle>{t("weeklyViews")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end justify-between gap-2">
            {weeklyData.map((item) => (
              <div key={item.day} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-primary/80 transition-all hover:bg-primary"
                  style={{ height: `${(item.views / maxViews) * 100}%`, minHeight: "8px" }}
                  title={`${item.views} ${t("views")}`}
                />
                <span className="text-xs text-muted-foreground">{item.day}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isStarter ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{tGrowth("lockedTitle")}</h2>
            <p className="text-sm text-muted-foreground">{tGrowth("lockedSubtitle")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {lockedCards.map(({ key, icon: Icon }) => (
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
                <p className="mt-3 text-sm font-semibold">{tGrowth(`locked.${key}.title`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tGrowth(`locked.${key}.body`)}
                </p>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card/90 to-transparent"
                />
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
