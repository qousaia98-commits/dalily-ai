"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { CheckCircle2, CreditCard, Images, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deferOnboardingAction } from "@/actions/onboarding-preference.actions";

const SUB_BENEFITS = ["search", "gallery", "contact", "matching"] as const;

export type OnboardingSuccessSubscriptionPrompt = {
  show: boolean;
  priceUsd: number;
};

type Props = {
  subscriptionPrompt?: OnboardingSuccessSubscriptionPrompt | null;
};

export function OnboardingSuccessStep({ subscriptionPrompt = null }: Props) {
  const t = useTranslations("business.onboarding.success");
  const ts = useTranslations("business.subscriptionVisibility");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const showSubscribe = Boolean(subscriptionPrompt?.show);
  const priceUsd = subscriptionPrompt?.priceUsd ?? 0;

  function goLater() {
    startTransition(async () => {
      await deferOnboardingAction();
      router.push("/business");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-9" aria-hidden />
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h2>
        {showSubscribe ? (
          <p className="text-base leading-relaxed text-muted-foreground">
            {ts("readyBody")}
          </p>
        ) : (
          <p className="text-base leading-relaxed text-muted-foreground">{t("onlineBody")}</p>
        )}
        <p className="text-sm leading-relaxed text-muted-foreground">{t("review")}</p>
      </div>

      <ul className="mx-auto max-w-md space-y-2 text-start text-sm text-foreground">
        <li className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <span>{t("bullets.created")}</span>
        </li>
        <li className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <span>{t("bullets.reviewing")}</span>
        </li>
        <li className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <span>{t("bullets.access")}</span>
        </li>
      </ul>

      {showSubscribe ? (
        <section
          className="mx-auto max-w-md space-y-4 rounded-3xl border border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,transparent)] p-5 text-start"
          aria-labelledby="onboarding-subscribe-title"
        >
          <div className="space-y-2">
            <h3
              id="onboarding-subscribe-title"
              className="text-base font-bold tracking-tight text-foreground"
            >
              {ts("title")}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {ts("body", { price: priceUsd })}
            </p>
          </div>
          <ul className="space-y-2 text-sm text-foreground">
            {SUB_BENEFITS.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
                <span>{ts(`benefits.${key}`)}</span>
              </li>
            ))}
          </ul>
          <Button
            asChild
            className="h-12 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
          >
            <Link href="/business/subscription" className="gap-2">
              <CreditCard className="size-4" aria-hidden />
              {ts("cta", { price: priceUsd })}
            </Link>
          </Button>
        </section>
      ) : null}

      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Button
          asChild
          className="h-12 rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)] sm:min-w-52"
        >
          <Link href="/business/media" className="gap-2">
            <Images className="size-4" aria-hidden />
            {t("completeProfile")}
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-2xl font-semibold sm:min-w-44"
          disabled={pending}
          onClick={goLater}
        >
          <LayoutDashboard className="size-4" aria-hidden />
          {t("maybeLater")}
        </Button>
      </div>
    </div>
  );
}
