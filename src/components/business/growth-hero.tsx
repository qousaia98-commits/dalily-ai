import { getTranslations } from "next-intl/server";
import { PlanBadge } from "@/components/shared/plan-badge";
import { getBenefits, resolvePlanDisplay } from "@/lib/subscription/benefit-engine";
import type { PlanSlug } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

export async function GrowthHero({
  planSlug,
  businessName,
}: {
  planSlug: PlanSlug;
  businessName: string;
}) {
  const t = await getTranslations("business.growth.hero");
  const benefits = getBenefits(planSlug);
  const display = resolvePlanDisplay(planSlug);
  const tier = display.marketingId;

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-8",
        benefits.showPremiumDashboardTheme
          ? "border-[var(--dalily-gold)]/40 bg-[linear-gradient(145deg,#0B1526_0%,#1a2744_100%)] text-white shadow-[0_20px_50px_-24px_rgba(11,21,38,0.45)]"
          : benefits.canUseProBadge
            ? "border-[var(--dalily-gold)]/35 bg-card dark:bg-card"
            : "border-border bg-card",
      )}
      style={
        !benefits.showPremiumDashboardTheme && benefits.canUseProBadge
          ? { backgroundImage: "linear-gradient(180deg, var(--card) 0%, color-mix(in oklab, var(--dalily-gold) 8%, var(--card)) 100%)" }
          : undefined
      }
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -end-8 -top-8 size-40 rounded-full blur-3xl motion-reduce:hidden",
          "bg-[var(--dalily-gold)]/20",
        )}
      />

      <div className="relative flex min-w-0 flex-wrap items-center gap-3">
        <h1
          className={cn(
            "min-w-0 text-balance text-3xl font-bold tracking-tight sm:text-4xl",
            benefits.showPremiumDashboardTheme
              ? "text-white"
              : "text-foreground",
          )}
        >
          {display.icon === "crown" ? "👑 " : display.icon === "star" ? "⭐ " : ""}
          {businessName}
        </h1>
        <PlanBadge planSlug={planSlug} size="md" />
      </div>

      <p
        className={cn(
          "relative mt-4 max-w-2xl text-base leading-relaxed sm:text-lg",
          benefits.showPremiumDashboardTheme
            ? "text-white/75"
            : "text-muted-foreground",
        )}
      >
        {t(`${tier}.subtitle`)}
      </p>
    </header>
  );
}
