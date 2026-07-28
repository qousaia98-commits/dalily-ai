"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CategoryOption } from "../types";
import type { CategorySuggestion } from "@/domains/customer/intent-types";

type CategoryStepProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  suggestion: CategorySuggestion | null;
  categories: CategoryOption[];
  categoryId: string;
  onCategoryChange: (categoryId: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function CategoryStep({
  t,
  locale,
  suggestion,
  categories,
  categoryId,
  onCategoryChange,
  onBack,
  onContinue,
}: CategoryStepProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("steps.category.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.category.subtitle")}</p>
      </div>
      {suggestion && (
        <p className="rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
          {t("steps.category.suggested", {
            category: locale === "ar" ? suggestion.labelAr : suggestion.labelEn,
          })}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="category">{t("steps.category.change")}</Label>
        <select
          id="category"
          className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">{t("trust.relevantOnly")}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
          {t("back")}
        </Button>
        <Button
          type="button"
          className="min-h-11 flex-1 rounded-xl"
          disabled={!categoryId}
          onClick={onContinue}
        >
          {t("continue")}
        </Button>
      </div>
    </section>
  );
}
