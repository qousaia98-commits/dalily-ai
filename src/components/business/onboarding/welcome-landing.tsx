"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deferOnboardingAction } from "@/actions/onboarding-preference.actions";

type Props = {
  onCompleteNow: () => void;
};

const BENEFITS = ["visibility", "score", "trust", "bookings"] as const;

/**
 * Calm welcome after registration — benefits first, never blocks forever.
 */
export function WelcomeLanding({ onCompleteNow }: Props) {
  const t = useTranslations("business.onboarding.welcome");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function chooseLater() {
    startTransition(async () => {
      await deferOnboardingAction();
      router.push("/business");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 animate-fade-in">
      <div className="rounded-3xl border border-[#E8ECF2] bg-white p-6 shadow-[0_16px_48px_-24px_rgba(11,21,38,0.28)] sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]">
          <Sparkles className="size-7" aria-hidden />
        </div>

        <div className="mt-5 space-y-3 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t("subtitle")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
        </div>

        <ul className="mt-6 space-y-2.5">
          {BENEFITS.map((key) => (
            <li
              key={key}
              className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-start text-sm text-[var(--dalily-navy)]"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>{t(`benefits.${key}`)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="h-12 flex-1 rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
            onClick={onCompleteNow}
            disabled={pending}
          >
            {t("completeNow")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-2xl font-semibold"
            onClick={chooseLater}
            disabled={pending}
          >
            {t("later")}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">{t("laterHint")}</p>
      </div>
    </div>
  );
}
