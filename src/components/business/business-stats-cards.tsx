import { TrendingUp, TrendingDown, Eye, Search, MousePointer, Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_BUSINESS_STATS } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

const statConfig = [
  { key: "profileViews" as const, icon: Eye, dataKey: "profileViews" as const, changeKey: "profileViewsChange" as const },
  { key: "searchAppearances" as const, icon: Search, dataKey: "searchAppearances" as const, changeKey: "searchAppearancesChange" as const },
  { key: "contactClicks" as const, icon: MousePointer, dataKey: "contactClicks" as const, changeKey: "contactClicksChange" as const },
  { key: "favorites" as const, icon: Heart, dataKey: "favorites" as const, changeKey: "favoritesChange" as const },
];

export async function BusinessStatsCards() {
  const t = await getTranslations("business.stats");
  const stats = MOCK_BUSINESS_STATS;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statConfig.map(({ key, icon: Icon, dataKey, changeKey }) => {
        const value = stats[dataKey];
        const change = stats[changeKey];
        const positive = change >= 0;

        return (
          <Card key={key} className="py-4">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(key)}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value.toLocaleString()}</p>
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-xs font-medium",
                  positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500",
                )}
              >
                {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {positive ? "+" : ""}
                {change}%
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
