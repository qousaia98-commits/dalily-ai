"use client";

import { Check, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CategorySuggestion } from "@/domains/customer/intent-types";

type ConfirmationStepProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  pending: boolean;
  locale: string;
  suggestion: CategorySuggestion;
  onAccept: () => void;
  onReject: () => void;
  onBack: () => void;
};

export function ConfirmationStep({
  t,
  pending,
  locale,
  suggestion,
  onAccept,
  onReject,
  onBack,
}: ConfirmationStepProps) {
  return (
    <section className="space-y-5 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6 animate-fade-in-up">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dalily-gold)]/30 bg-[color-mix(in_oklab,var(--dalily-gold)_10%,transparent)] px-3 py-1 text-xs font-semibold">
        <Sparkles className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
        {t("steps.confirm.badge")}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("steps.confirm.title", {
            category: locale === "ar" ? suggestion.labelAr : suggestion.labelEn,
          })}
        </h2>
        <p className="text-sm text-muted-foreground">{t("steps.confirm.subtitle")}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          className="min-h-12 rounded-xl gap-2"
          disabled={pending}
          onClick={onAccept}
        >
          <Check className="size-4" aria-hidden />
          {t("steps.confirm.yes")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 rounded-xl gap-2"
          onClick={onReject}
        >
          <Pencil className="size-4" aria-hidden />
          {t("steps.confirm.no")}
        </Button>
      </div>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {t("back")}
      </Button>
    </section>
  );
}
