"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Link } from "@/lib/i18n/routing";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deferOnboardingAction,
  dismissOnboardingCardAction,
} from "@/actions/onboarding-preference.actions";
import type { OnboardingReminderCopyId } from "@/lib/business/onboarding-reminders";

type Props = {
  copyId: OnboardingReminderCopyId;
  href?: string;
};

const BENEFITS = ["bookings", "score", "trust", "ranking"] as const;

/**
 * Soft dashboard encouragement card — never blocks workflows.
 */
export function OnboardingDashboardCard({ copyId, href = "/business/welcome" }: Props) {
  const t = useTranslations("business.onboarding.dashboardCard");
  const tr = useTranslations("business.onboarding.reminders");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remindLater() {
    startTransition(async () => {
      await dismissOnboardingCardAction();
      await deferOnboardingAction();
      router.refresh();
    });
  }

  function dismiss() {
    startTransition(async () => {
      await dismissOnboardingCardAction();
      router.refresh();
    });
  }

  return (
    <section
      className="relative rounded-3xl border border-[var(--dalily-gold)]/35 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)] p-5 shadow-sm sm:p-6"
      aria-labelledby="onboarding-card-title"
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

      <h2 id="onboarding-card-title" className="pe-10 text-lg font-bold tracking-tight text-[var(--dalily-navy)]">
        {t("title")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {tr(`${copyId}.body`)}
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {BENEFITS.map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm text-[var(--dalily-navy)]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            {t(`benefits.${key}`)}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button
          asChild
          className="h-11 rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
        >
          <Link href={href}>{t("complete")}</Link>
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
