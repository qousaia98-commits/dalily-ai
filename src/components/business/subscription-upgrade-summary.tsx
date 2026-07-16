"use client";

import { Check, Crown, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketingPlanId } from "@/components/business/subscription-plan-cards";

const SUMMARY_FEATURES: Record<"pro" | "premium", string[]> = {
  pro: ["ranking", "badge", "insights", "visibility", "support"],
  premium: ["everything", "homepage", "badge", "branches", "insights"],
};

type SubscriptionUpgradeSummaryProps = {
  planId: Extract<MarketingPlanId, "pro" | "premium">;
  pending?: boolean;
  onContinue: () => void;
  onBack: () => void;
};

export function SubscriptionUpgradeSummary({
  planId,
  pending = false,
  onContinue,
  onBack,
}: SubscriptionUpgradeSummaryProps) {
  const t = useTranslations("business.subscription");
  const isPremium = planId === "premium";
  const Icon = isPremium ? Crown : Sparkles;

  return (
    <div className="mx-auto w-full max-w-lg animate-fade-in">
      <div
        className={cn(
          "overflow-hidden rounded-3xl border shadow-[0_20px_50px_-24px_rgba(11,21,38,0.35)]",
          isPremium
            ? "border-[var(--dalily-gold)]/35 bg-[linear-gradient(165deg,#0B1526_0%,#1a2744_100%)] text-white"
            : "border-[var(--dalily-gold)]/40 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)]",
        )}
      >
        <div className="space-y-6 px-6 py-8 sm:px-8">
          <div>
            <p
              className={cn(
                "text-xs font-bold tracking-[0.16em] uppercase",
                "text-[var(--dalily-gold)]",
              )}
            >
              {t("summary.eyebrow")}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--dalily-gold)]/18 text-[var(--dalily-gold)]">
                <Icon className="size-6" aria-hidden />
              </span>
              <div>
                <h2
                  className={cn(
                    "text-2xl font-bold tracking-tight",
                    isPremium ? "text-white" : "text-[var(--dalily-navy)]",
                  )}
                >
                  {t(`plans.${planId}.name`)}
                </h2>
                <p className={cn("text-sm", isPremium ? "text-white/60" : "text-muted-foreground")}>
                  {t(`plans.${planId}.price`)} / {t("perMonth")}
                </p>
              </div>
            </div>
          </div>

          <p className={cn("text-base leading-relaxed", isPremium ? "text-white/75" : "text-[#5C6478]")}>
            {t(`summary.blurb.${planId}`)}
          </p>

          <ul className="space-y-3">
            {SUMMARY_FEATURES[planId].map((key) => (
              <li key={key} className="flex items-start gap-3 text-sm leading-snug">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--dalily-gold)]/20 text-[var(--dalily-gold)]">
                  <Check className="size-3 stroke-[3]" aria-hidden />
                </span>
                <span className={isPremium ? "text-white/90" : "text-[var(--dalily-navy)]"}>
                  {t(`plans.${planId}.includes.${key}`)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="button"
              disabled={pending}
              onClick={onContinue}
              className="h-14 w-full rounded-2xl bg-[var(--dalily-gold)] text-base font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)] focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
            >
              {t("summary.continue")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={onBack}
              className={cn(
                "h-12 w-full rounded-2xl text-sm font-semibold",
                isPremium ? "text-white/80 hover:bg-white/10 hover:text-white" : "",
              )}
            >
              {t("summary.back")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
