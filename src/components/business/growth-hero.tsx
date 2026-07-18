import { getTranslations } from "next-intl/server";
import { PlanBadge } from "@/components/shared/plan-badge";
import { getBenefits, resolvePlanDisplay } from "@/lib/subscription/benefit-engine";
import type { PlanSlug } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

export async function GrowthHero({
  planSlug,
  businessName,
  pendingRequests = 0,
  unreadMessages = 0,
}: {
  planSlug: PlanSlug;
  businessName: string;
  pendingRequests?: number;
  unreadMessages?: number;
}) {
  const t = await getTranslations("business.growth.hero");
  const benefits = getBenefits(planSlug);
  const display = resolvePlanDisplay(planSlug);
  const tier = display.marketingId;

  const attention =
    pendingRequests > 0
      ? t("attention.requests", { count: pendingRequests })
      : unreadMessages > 0
        ? t("attention.messages", { count: unreadMessages })
        : t(`${tier}.subtitle`);

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-3xl border p-5 sm:p-7",
        benefits.showPremiumDashboardTheme
          ? "border-[var(--dalily-gold)]/40 bg-[linear-gradient(145deg,#0B1526_0%,#1a2744_100%)] text-white shadow-[0_20px_50px_-24px_rgba(11,21,38,0.45)]"
          : benefits.canUseProBadge
            ? "border-[var(--dalily-gold)]/35 bg-card dark:bg-card"
            : "border-border bg-card",
      )}
      style={
        !benefits.showPremiumDashboardTheme && benefits.canUseProBadge
          ? {
              backgroundImage:
                "linear-gradient(180deg, var(--card) 0%, color-mix(in oklab, var(--dalily-gold) 8%, var(--card)) 100%)",
            }
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
            "min-w-0 text-balance text-2xl font-bold tracking-tight sm:text-3xl",
            benefits.showPremiumDashboardTheme ? "text-white" : "text-foreground",
          )}
        >
          {t(`${tier}.title`, { name: businessName })}
        </h1>
        <PlanBadge planSlug={planSlug} size="md" />
      </div>

      <p
        className={cn(
          "relative mt-3 max-w-2xl text-sm leading-relaxed sm:text-base",
          benefits.showPremiumDashboardTheme ? "text-white/80" : "text-muted-foreground",
          (pendingRequests > 0 || unreadMessages > 0) && "font-medium",
        )}
      >
        {attention}
      </p>
    </header>
  );
}
