import { TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { getBenefits } from "@/lib/subscription/benefit-engine";
import type { PlanSlug } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

export async function DashboardGrowthSection({
  planSlug,
  healthScore,
  searchAppearances,
}: {
  planSlug: PlanSlug;
  healthScore: number;
  searchAppearances: number;
}) {
  const t = await getTranslations("business.dashboard.growth");
  const benefits = getBenefits(planSlug);

  return (
    <section
      className={cn(
        "rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6",
        benefits.showPremiumDashboardTheme && "border-[var(--dalily-gold)]/30",
      )}
      aria-labelledby="dash-growth-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]">
            <TrendingUp className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="dash-growth-title" className="text-lg font-bold text-foreground">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {benefits.canViewGrowthDashboard
                ? t("bodyUnlocked", { score: healthScore, searches: searchAppearances })
                : t("bodyLocked")}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="h-11 shrink-0 rounded-2xl">
          <Link href="/business/analytics">{t("cta")}</Link>
        </Button>
      </div>
    </section>
  );
}
