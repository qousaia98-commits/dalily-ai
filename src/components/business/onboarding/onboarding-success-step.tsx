"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { CheckCircle2, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OnboardingSuccessStep() {
  const t = useTranslations("business.onboarding.success");

  return (
    <div className="space-y-8 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
        <CheckCircle2 className="size-9" aria-hidden />
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-3xl">
          {t("title")}
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">{t("review")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("dashboardHint")}</p>
      </div>

      <ul className="mx-auto max-w-md space-y-2 text-start text-sm text-[var(--dalily-navy)]">
        <li className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          <span>{t("bullets.created")}</span>
        </li>
        <li className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          <span>{t("bullets.reviewing")}</span>
        </li>
        <li className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          <span>{t("bullets.access")}</span>
        </li>
      </ul>

      <Button
        asChild
        className="h-12 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)] sm:w-auto sm:min-w-56"
      >
        <Link href="/business" className="gap-2">
          <LayoutDashboard className="size-4" aria-hidden />
          {t("cta")}
        </Link>
      </Button>
    </div>
  );
}
