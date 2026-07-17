"use client";

import { ArrowRight, Sparkles, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { getBenefits } from "@/lib/subscription/benefit-engine";
import type { PlanSlug } from "@/lib/subscription/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardUpgradeCardProps = {
  planSlug: PlanSlug;
  status: string;
  providerApproved?: boolean;
};

/**
 * Upgrade CTA for Starter → PRO and PRO → PREMIUM.
 * Premium active: no permanent success card (celebration lives in temporary notifications).
 */
export function DashboardUpgradeCard({
  planSlug,
  status,
  providerApproved = true,
}: DashboardUpgradeCardProps) {
  const t = useTranslations("business.dashboard.upgradeCard");
  const benefits = getBenefits(planSlug);
  const isPending = status === "pending_payment";
  const isProActive = benefits.canUseProBadge && !benefits.canUsePremiumBadge && status === "active";

  if (!providerApproved) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-sm font-semibold text-[var(--dalily-navy)]">{t("lockedTitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("lockedBody")}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/business/verification">{t("lockedCta")}</Link>
        </Button>
      </div>
    );
  }

  // Premium: never show a permanent "activated successfully" card.
  if (benefits.canUsePremiumBadge && status === "active") {
    return null;
  }

  const dark = isProActive;
  const Icon = isProActive ? Star : Sparkles;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-8 shadow-[0_14px_36px_-18px_rgba(11,21,38,0.22)]",
        dark
          ? "border-[var(--dalily-navy)]/15 bg-[linear-gradient(145deg,#0B1526_0%,#1a2744_100%)] text-white"
          : "border-[var(--dalily-gold)]/45 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)]",
      )}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--dalily-gold)]/20 text-[var(--dalily-gold)]">
            <Icon className="size-6" />
          </span>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
              <Star className="size-3.5 fill-current" />
              {isProActive ? t("proEyebrow") : t("starterEyebrow")}
            </p>
            <h2
              className={cn(
                "mt-2 text-xl font-bold tracking-tight sm:text-2xl",
                dark ? "text-white" : "text-[var(--dalily-navy)]",
              )}
            >
              {isProActive ? t("proTitle") : t("starterTitle")}
            </h2>
            <p className={cn("mt-2 max-w-md text-sm leading-relaxed", dark ? "text-white/70" : "text-[#5C6478]")}>
              {isProActive ? t("proBody") : t("starterBody")}
            </p>
          </div>
        </div>

        <Button
          asChild
          className="h-12 shrink-0 rounded-2xl bg-[var(--dalily-gold)] px-6 font-bold text-[var(--dalily-navy)] hover:bg-[#D4B76A]"
        >
          <Link href="/business/subscription" className="gap-2">
            {isProActive ? t("proCta") : t("starterCta")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {isPending ? (
        <p
          className={cn(
            "mt-5 rounded-2xl px-4 py-3 text-sm",
            dark ? "bg-white/10 text-white/80" : "bg-[var(--dalily-navy)]/5 text-[var(--dalily-navy)]",
          )}
        >
          {t("pendingNote")}
        </p>
      ) : null}
    </div>
  );
}
