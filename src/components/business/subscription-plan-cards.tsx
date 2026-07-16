"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Crown,
  Loader2,
  Sparkles,
  Sprout,
  Star,
} from "lucide-react";
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

/** Outcome-focused benefit keys (i18n under plans.*.includes) */
const featureKeys: Record<MarketingPlanId, string[]> = {
  starter: ["profile", "photos", "reviews", "contact", "search"],
  pro: ["ranking", "badge", "insights", "visibility", "support"],
  premium: ["everything", "homepage", "badge", "branches", "insights"],
};

type SubscriptionPlanCardsProps = {
  currentPlanSlug: PlanSlug;
  status: string;
  pending?: boolean;
  mode?: "upgrade" | "welcome";
  /** Called when user commits to a plan (CTA inside expanded card). */
  onSelectPlan: (plan: MarketingPlanId) => void;
};

export function planSlugToMarketing(slug: PlanSlug): MarketingPlanId {
  return MARKETING_BY_SLUG[slug];
}

export function marketingToPlanSlug(id: MarketingPlanId): PlanSlug {
  return SLUG_BY_MARKETING[id];
}

export function rankPlan(id: MarketingPlanId): number {
  if (id === "starter") return 0;
  if (id === "pro") return 1;
  return 2;
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
  const [expanded, setExpanded] = useState<MarketingPlanId | null>("pro");

  return (
    <div className="flex w-full flex-col gap-5 md:gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-7">
      {PLAN_ORDER.map((planId) => {
        const isPro = planId === "pro";
        const isPremium = planId === "premium";
        const isStarter = planId === "starter";
        const isExpanded = expanded === planId;
        const isCurrent =
          currentMarketing === planId && (status === "active" || status === "trial");
        const showStarterCta = isStarter && (mode === "welcome" || !isCurrent);
        const showPaidCta =
          !isStarter &&
          !paymentLocked &&
          (mode === "welcome" ? !isCurrent : rankPlan(planId) > rankPlan(currentMarketing));
        const showCta = showStarterCta || showPaidCta;
        const Icon = isPremium ? Crown : isPro ? Sparkles : Sprout;
        const panelId = `plan-panel-${planId}`;

        return (
          <article
            key={planId}
            className={cn(
              "relative w-full overflow-hidden rounded-3xl transition-[box-shadow,transform] duration-300 ease-out",
              "motion-safe:active:scale-[0.995]",
              isStarter &&
                "border border-[#E8ECF2] bg-white shadow-[0_12px_40px_-20px_rgba(11,21,38,0.18)]",
              isPro &&
                "border-2 border-[var(--dalily-gold)] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBF8F0_100%)] shadow-[0_18px_50px_-16px_rgba(196,160,82,0.45)] ring-1 ring-[var(--dalily-gold)]/30",
              isPremium &&
                "border border-[var(--dalily-gold)]/35 bg-[linear-gradient(165deg,#0B1526_0%,#151f33_55%,#1a2744_100%)] text-white shadow-[0_22px_56px_-18px_rgba(11,21,38,0.65)]",
              isExpanded && "z-10",
              isCurrent && isStarter && "ring-2 ring-[var(--dalily-navy)]/15",
            )}
          >
            {isPro ? (
              <div className="absolute -top-px start-1/2 z-10 -translate-x-1/2 rtl:translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-b-2xl bg-[var(--dalily-gold)] px-4 py-1.5 text-xs font-bold tracking-wide text-[var(--dalily-navy)] shadow-md">
                  <Star className="size-3.5 fill-current" aria-hidden />
                  {t("plans.pro.badge")}
                </span>
              </div>
            ) : null}

            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={panelId}
              onClick={() => setExpanded((prev) => (prev === planId ? null : planId))}
              className={cn(
                "flex w-full flex-col px-5 pb-4 pt-7 text-start outline-none transition-colors sm:px-7 sm:pt-8",
                "focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)] focus-visible:ring-offset-2",
                isPro && "pt-10 sm:pt-11",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-2xl",
                    isPremium && "bg-[var(--dalily-gold)]/18 text-[var(--dalily-gold)]",
                    isPro && "bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]",
                    isStarter && "bg-[var(--dalily-navy)]/5 text-[var(--dalily-navy)]",
                  )}
                >
                  <Icon className="size-7" aria-hidden />
                </span>
                <span className="flex items-center gap-2">
                  {isCurrent ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold",
                        isPremium ? "bg-white/15 text-white" : "bg-[var(--dalily-navy)]/8 text-[var(--dalily-navy)]",
                      )}
                    >
                      {t("current")}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 transition-transform duration-300 ease-out",
                      isPremium ? "text-white/50" : "text-muted-foreground",
                      isExpanded && "rotate-180",
                      "motion-reduce:transition-none",
                    )}
                    aria-hidden
                  />
                </span>
              </div>

              <p
                className={cn(
                  "mt-5 text-xs font-bold tracking-[0.16em] uppercase",
                  isPremium ? "text-[var(--dalily-gold)]" : "text-[var(--dalily-gold)]",
                )}
              >
                {t(`plans.${planId}.name`)}
              </p>

              <div className="mt-2 flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "text-4xl font-bold tracking-tight sm:text-5xl",
                    isPremium ? "text-white" : "text-[var(--dalily-navy)]",
                  )}
                >
                  {isStarter ? t("plans.starter.price") : t(`plans.${planId}.price`)}
                </span>
                {!isStarter ? (
                  <span className={cn("text-sm font-medium", isPremium ? "text-white/55" : "text-muted-foreground")}>
                    / {t("perMonth")}
                  </span>
                ) : null}
              </div>

              <h3
                className={cn(
                  "mt-5 text-balance text-2xl font-bold leading-snug tracking-tight sm:text-[1.65rem]",
                  isPremium ? "text-white" : "text-[var(--dalily-navy)]",
                )}
              >
                {t(`plans.${planId}.headline`)}
              </h3>
              <p
                className={cn(
                  "mt-2 text-pretty text-base leading-relaxed",
                  isPremium ? "text-white/70" : "text-[#5C6478]",
                )}
              >
                {t(`plans.${planId}.subtitle`)}
              </p>
            </button>

            <div
              id={panelId}
              role="region"
              aria-label={t(`plans.${planId}.name`)}
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="space-y-6 px-5 pb-6 sm:px-7 sm:pb-8">
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      isPremium ? "text-white/60" : "text-muted-foreground",
                    )}
                  >
                    {t(`plans.${planId}.why`)}
                  </p>

                  <ul className="space-y-3.5">
                    {featureKeys[planId].map((key) => (
                      <li key={key} className="flex items-start gap-3 text-[0.9375rem] leading-snug">
                        <span
                          className={cn(
                            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                            isPremium
                              ? "bg-[var(--dalily-gold)]/20 text-[var(--dalily-gold)]"
                              : "bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]",
                          )}
                        >
                          <Check className="size-3.5 stroke-[3]" aria-hidden />
                        </span>
                        <span className={isPremium ? "text-white/90" : "text-[var(--dalily-navy)]/90"}>
                          {t(`plans.${planId}.includes.${key}`)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div>
                    {showCta ? (
                      <Button
                        type="button"
                        disabled={pending || (paymentLocked && !isStarter)}
                        aria-label={t(`plans.${planId}.cta`)}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectPlan(planId);
                        }}
                        className={cn(
                          "h-14 w-full rounded-2xl text-base font-bold transition-transform duration-200",
                          "motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.98]",
                          "focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)] focus-visible:ring-offset-2",
                          (isPro || isPremium) &&
                            "bg-[var(--dalily-gold)] text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]",
                          isStarter &&
                            "border-2 border-[var(--dalily-navy)]/12 bg-white text-[var(--dalily-navy)] hover:bg-[#F7F8FA]",
                        )}
                        variant={isStarter ? "outline" : "default"}
                      >
                        {pending ? <Loader2 className="size-5 animate-spin" /> : t(`plans.${planId}.cta`)}
                      </Button>
                    ) : (
                      <div
                        className={cn(
                          "flex h-14 w-full items-center justify-center rounded-2xl text-sm font-semibold",
                          isPremium
                            ? "bg-white/10 text-white"
                            : "bg-[var(--dalily-navy)]/5 text-[var(--dalily-navy)]",
                        )}
                      >
                        {t("current")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
