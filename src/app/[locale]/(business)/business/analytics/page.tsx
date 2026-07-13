import { getTranslations } from "next-intl/server";
import { BusinessStatsCards } from "@/components/business/business-stats-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BusinessAnalyticsPage() {
  const t = await getTranslations("business.analytics");

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

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
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
    </div>
  );
}
