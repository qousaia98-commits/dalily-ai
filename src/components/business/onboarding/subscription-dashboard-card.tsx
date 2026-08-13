"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissSubscriptionCardAction } from "@/actions/onboarding-preference.actions";

const BENEFITS = ["search", "gallery", "contact", "matching"] as const;

type Props = {
  priceUsd: number;
  href?: string;
};

/**
 * Soft dashboard nudge until the provider’s Business subscription makes them visible.
 * Dismissible with the same cooldown pattern as OnboardingDashboardCard.
 */
export function SubscriptionDashboardCard({
  priceUsd,
  href = "/business/subscription",
}: Props) {
  const t = useTranslations("business.subscriptionVisibility");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remindLater() {
    startTransition(async () => {
      await dismissSubscriptionCardAction();
      router.refresh();
    });
  }

  function dismiss() {
    startTransition(async () => {
      await dismissSubscriptionCardAction();
      router.refresh();
    });
  }

  return (
    <section
      className="relative rounded-3xl border border-[var(--dalily-gold)]/35 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--dalily-gold)_10%,var(--card))_0%,var(--card)_100%)] p-5 shadow-sm sm:p-6"
      aria-labelledby="subscription-card-title"
    >
      <button
        type="button"
        className="absolute end-3 top-3 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
        onClick={dismiss}
        disabled={pending}
        aria-label={t("dismiss")}
      >
        <X className="size-4" aria-hidden />
      </button>

      <h2
        id="subscription-card-title"
        className="pe-10 text-lg font-bold tracking-tight text-foreground"
      >
        {t("title")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("body", { price: priceUsd })}
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {BENEFITS.map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            {t(`benefits.${key}`)}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button
          asChild
          className="h-11 rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
        >
          <Link href={href}>{t("cta", { price: priceUsd })}</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-2xl"
          disabled={pending}
          onClick={remindLater}
        >
          {t("remindLater")}
        </Button>
      </div>
    </section>
  );
}
