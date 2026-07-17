import { Eye, Heart, MousePointer, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { WeeklyInsights } from "@/lib/business/insights";
import { getBenefits } from "@/lib/subscription/benefit-engine";
import type { PlanSlug } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

const STATS = [
  { key: "searchAppearances", icon: Search, field: "searchAppearances" as const },
  { key: "profileViews", icon: Eye, field: "profileViews" as const },
  { key: "contactClicks", icon: MousePointer, field: "contactClicks" as const },
  { key: "favorites", icon: Heart, field: "favorites" as const },
] as const;

export async function DashboardKeyStats({
  insights,
  planSlug,
  healthScore,
}: {
  insights: WeeklyInsights;
  planSlug: PlanSlug;
  healthScore: number;
}) {
  const t = await getTranslations("business.dashboard.keyStats");
  const benefits = getBenefits(planSlug);

  return (
    <section className="space-y-4" aria-labelledby="key-stats-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="key-stats-title" className="text-lg font-bold tracking-tight text-foreground">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {t("health", { score: healthScore })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map(({ key, icon: Icon, field }) => {
          const raw = insights[field];
          const locked = !benefits.canViewProfileViews && field !== "searchAppearances";
          const empty = raw === null;
          const value = locked ? "—" : empty ? "—" : String(raw);

          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border border-border bg-card p-4 shadow-sm",
                "transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
                "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              )}
            >
              <div className="flex items-center gap-2 text-[var(--dalily-gold)]">
                <Icon className="size-4 shrink-0" aria-hidden />
                <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t(key)}
                </p>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {value}
              </p>
              {locked ? (
                <p className="mt-1 text-xs text-muted-foreground">{t("unlockPro")}</p>
              ) : empty ? (
                <p className="mt-1 text-xs text-muted-foreground">{t("empty")}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
