"use client";

import { Check, Crown, Loader2, Sparkles, Sprout, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanSlug } from "@/lib/subscription/types";

export type MarketingPlanId = "starter" | "pro" | "premium";

const PLAN_ORDER: MarketingPlanId[] = ["starter", "pro", "premium"];

const SLUG_BY_MARKETING: Record<MarketingPlanId, PlanSlug> = {
  starter: "free",
  pro: "pro",
  premium: "premium",
};

const MARKETING_BY_SLUG: Record<PlanSlug, MarketingPlanId> = {
  free: "starter",
  pro: "pro",
  premium: "premium",
};

type SubscriptionPlanCardsProps = {
  currentPlanSlug: PlanSlug;
  status: string;
  pending?: boolean;
  mode?: "upgrade" | "welcome";
  onSelectPlan: (plan: MarketingPlanId) => void;
};

const featureKeys: Record<MarketingPlanId, string[]> = {
  starter: ["profile", "photos", "info", "reviews", "search"],
  pro: ["ranking", "badge", "visibility", "stats", "ai", "priority"],
  premium: ["top", "homepage", "badge", "locations", "support", "early"],
};

export function planSlugToMarketing(slug: PlanSlug): MarketingPlanId {
  return MARKETING_BY_SLUG[slug];
}

export function marketingToPlanSlug(id: MarketingPlanId): PlanSlug {
  return SLUG_BY_MARKETING[id];
}

export function SubscriptionPlanCards({
  currentPlanSlug,
  status,
  pending = false,
  mode = "upgrade",
  onSelectPlan,
}: SubscriptionPlanCardsProps) {
  const t = useTranslations("business.subscription");
  const currentMarketing = planSlugToMarketing(currentPlanSlug);
  const paymentLocked = status === "pending_payment";

  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:gap-8 lg:items-stretch">
      {PLAN_ORDER.map((planId) => {
        const isPro = planId === "pro";
        const isPremium = planId === "premium";
        const isStarter = planId === "starter";
        const isCurrent =
          currentMarketing === planId && (status === "active" || status === "trial");
        const showStarterCta = isStarter && (mode === "welcome" || !isCurrent);
        const showPaidCta =
          !isStarter &&
          !paymentLocked &&
          (mode === "welcome" ? !isCurrent : rank(planId) > rank(currentMarketing));
        const showCta = showStarterCta || showPaidCta;

        const Icon = isPremium ? Crown : isPro ? Sparkles : Sprout;

        return (
          <article
            key={planId}
            className={cn(
              "relative flex flex-col rounded-3xl border bg-white p-8 shadow-[0_12px_40px_-16px_rgba(11,21,38,0.18)] transition-all duration-300",
              "hover:-translate-y-1 hover:shadow-[0_20px_50px_-18px_rgba(11,21,38,0.28)]",
              isPro &&
                "z-10 border-[var(--dalily-gold)]/50 ring-2 ring-[var(--dalily-gold)]/40 lg:scale-[1.04] bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)]",
              isPremium &&
                "border-[var(--dalily-navy)]/20 bg-[linear-gradient(165deg,#0B1526_0%,#1a2744_100%)] text-white shadow-[0_16px_48px_-12px_rgba(11,21,38,0.55)]",
              isStarter && "border-[#E8ECF2]",
              isCurrent && !isPremium && "ring-2 ring-[var(--dalily-navy)]/30",
            )}
          >
            {isPro ? (
              <div className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dalily-gold)] px-3.5 py-1 text-xs font-bold tracking-wide text-[var(--dalily-navy)] shadow-md">
                  <Star className="size-3.5 fill-current" />
                  {t("plans.pro.badge")}
                </span>
              </div>
            ) : null}

            <div className="mb-6 flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-2xl",
                  isPremium
                    ? "bg-[var(--dalily-gold)]/20 text-[var(--dalily-gold)]"
                    : isPro
                      ? "bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]"
                      : "bg-[var(--dalily-navy)]/5 text-[var(--dalily-navy)]",
                )}
              >
                <Icon className="size-6" />
              </div>
              {isCurrent ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    isPremium ? "bg-white/15 text-white" : "bg-[var(--dalily-navy)]/8 text-[var(--dalily-navy)]",
                  )}
                >
                  {t("current")}
                </span>
              ) : null}
            </div>

            <p
              className={cn(
                "text-xs font-bold tracking-[0.14em] uppercase",
                isPremium ? "text-[var(--dalily-gold)]" : "text-[var(--dalily-gold)]",
              )}
            >
              {t(`plans.${planId}.name`)}
            </p>

            <div className="mt-3 flex items-baseline gap-1">
              <span
                className={cn(
                  "text-4xl font-bold tracking-tight",
                  isPremium ? "text-white" : "text-[var(--dalily-navy)]",
                )}
              >
                {isStarter ? t("plans.starter.price") : t(`plans.${planId}.price`)}
              </span>
              {!isStarter ? (
                <span className={cn("text-sm", isPremium ? "text-white/60" : "text-muted-foreground")}>
                  / {t("perMonth")}
                </span>
              ) : null}
            </div>

            <h3
              className={cn(
                "mt-5 text-xl font-bold leading-snug tracking-tight",
                isPremium ? "text-white" : "text-[var(--dalily-navy)]",
              )}
            >
              {t(`plans.${planId}.headline`)}
            </h3>
            <p className={cn("mt-2 text-sm leading-relaxed", isPremium ? "text-white/70" : "text-[#5C6478]")}>
              {t(`plans.${planId}.subtitle`)}
            </p>
            <p className={cn("mt-3 text-sm leading-relaxed", isPremium ? "text-white/55" : "text-muted-foreground")}>
              {t(`plans.${planId}.description`)}
            </p>

            <ul className="mt-8 flex-1 space-y-3.5">
              {featureKeys[planId].map((key) => (
                <li key={key} className="flex items-start gap-3 text-sm leading-snug">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                      isPremium
                        ? "bg-[var(--dalily-gold)]/20 text-[var(--dalily-gold)]"
                        : "bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]",
                    )}
                  >
                    <Check className="size-3 stroke-[3]" />
                  </span>
                  <span className={isPremium ? "text-white/85" : "text-[var(--dalily-navy)]/85"}>
                    {t(`plans.${planId}.includes.${key}`)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {showCta ? (
                <Button
                  type="button"
                  disabled={pending || (paymentLocked && !isStarter)}
                  onClick={() => onSelectPlan(planId)}
                  className={cn(
                    "h-12 w-full rounded-2xl text-sm font-bold transition-transform duration-200 hover:scale-[1.02]",
                    isPro &&
                      "bg-[var(--dalily-gold)] text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light,#D4B76A)]",
                    isPremium &&
                      "bg-[var(--dalily-gold)] text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light,#D4B76A)]",
                    isStarter &&
                      "border-2 border-[var(--dalily-navy)]/15 bg-white text-[var(--dalily-navy)] hover:bg-[#F7F8FA]",
                  )}
                  variant={isStarter ? "outline" : "default"}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : t(`plans.${planId}.cta`)}
                </Button>
              ) : (
                <div
                  className={cn(
                    "w-full rounded-2xl border py-3 text-center text-sm font-semibold",
                    isPremium
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-[#E8ECF2] bg-[#F7F8FA] text-[var(--dalily-navy)]",
                  )}
                >
                  {t("current")}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function rank(id: MarketingPlanId): number {
  if (id === "starter") return 0;
  if (id === "pro") return 1;
  return 2;
}
