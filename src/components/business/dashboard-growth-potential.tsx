import { Crown, Sparkles, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import type { GrowthPotentialResult } from "@/lib/business/growth-potential";
import type { PlanSlug } from "@/lib/subscription/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Growth Potential — Growth / Analytics page only.
 * Never invents numbers. Elegant empty state when snapshots unavailable.
 */
export async function DashboardGrowthPotential({
  growth,
  planSlug,
}: {
  growth: GrowthPotentialResult;
  planSlug: PlanSlug;
}) {
  const t = await getTranslations("business.growthPotential");

  if (growth.unavailable && growth.categorySearches === 0 && growth.snapshotsUsed === 0) {
    return (
      <section
        className="rounded-3xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center"
        aria-labelledby="growth-potential-title"
      >
        <TrendingUp
          className="mx-auto size-8 text-[var(--dalily-gold)]"
          aria-hidden
        />
        <h2
          id="growth-potential-title"
          className="mt-4 text-lg font-bold text-foreground"
        >
          {t("emptyTitle")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("emptyBody")}
        </p>
      </section>
    );
  }

  if (planSlug === "premium") {
    return (
      <section
        className="rounded-3xl border border-[var(--dalily-gold)]/30 bg-[linear-gradient(165deg,#0B1526_0%,#151f33_100%)] px-5 py-6 text-white"
        aria-labelledby="growth-potential-title"
      >
        <div className="flex items-center gap-2">
          <Crown className="size-5 text-[var(--dalily-gold)]" aria-hidden />
          <h2 id="growth-potential-title" className="text-lg font-bold">
            {t("premiumTitle")}
          </h2>
        </div>
        <p className="mt-2 text-sm text-white/70">{t("premiumBody")}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <dt className="text-xs text-white/60">{t("impressions")}</dt>
            <dd className="mt-1 text-2xl font-bold">{growth.currentAppearances}</dd>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <dt className="text-xs text-white/60">{t("categorySearches")}</dt>
            <dd className="mt-1 text-2xl font-bold">{growth.categorySearches}</dd>
          </div>
        </dl>
      </section>
    );
  }

  const showPro = planSlug === "free";
  const showPremium = planSlug === "free" || planSlug === "pro";

  return (
    <section
      className="space-y-4 rounded-3xl border border-border bg-card px-5 py-6 shadow-sm"
      aria-labelledby="growth-potential-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-[var(--dalily-gold)]" aria-hidden />
            <h2 id="growth-potential-title" className="text-lg font-bold text-foreground">
              {t("title")}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild className="rounded-2xl">
          <Link href="/business/subscription">
            {planSlug === "pro" ? t("ctaPremium") : t("ctaPro")}
          </Link>
        </Button>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("categorySearches")}
          </dt>
          <dd className="mt-1 text-3xl font-bold text-foreground">{growth.categorySearches}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("yourAppearances")}
          </dt>
          <dd className="mt-1 text-3xl font-bold text-foreground">{growth.currentAppearances}</dd>
        </div>
      </dl>

      {!growth.unavailable ? (
        <ul className="space-y-2">
          {showPro ? (
            <li
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
                "border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))]",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-[var(--dalily-gold)]" aria-hidden />
                {t("withPro")}
              </span>
              <span className="text-lg font-bold">{growth.proAppearances}</span>
            </li>
          ) : null}
          {showPremium ? (
            <li
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
                "border-[var(--dalily-navy)]/20 bg-muted/40",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Crown className="size-4 text-[var(--dalily-gold)]" aria-hidden />
                {t("withPremium")}
              </span>
              <span className="text-lg font-bold">{growth.premiumAppearances}</span>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("legacyHint")}</p>
      )}

      {growth.snapshotsUsed > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("realCalc", { count: growth.snapshotsUsed })}
        </p>
      ) : null}
    </section>
  );
}
