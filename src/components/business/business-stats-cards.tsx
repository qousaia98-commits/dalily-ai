import { Eye, Search, MousePointer, Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyInsights } from "@/lib/business/analytics-database";

const statConfig = [
  { key: "profileViews" as const, icon: Eye, field: "profileViews" as const },
  { key: "searchAppearances" as const, icon: Search, field: "searchAppearances" as const },
  { key: "contactClicks" as const, icon: MousePointer, field: "contactClicks" as const },
  { key: "favorites" as const, icon: Heart, field: "favorites" as const },
];

/** Real analytics only — never mock or invent values. */
export async function BusinessStatsCards({ insights }: { insights: WeeklyInsights }) {
  const t = await getTranslations("business.stats");

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statConfig.map(({ key, icon: Icon, field }) => {
        const raw = insights[field];
        const value = raw == null ? null : Number(raw);

        return (
          <Card key={key} className="py-4">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(key)}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {value == null ? "—" : value.toLocaleString()}
              </p>
              {value == null ? (
                <p className="mt-1 text-xs text-muted-foreground">{t("waitingReal")}</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
