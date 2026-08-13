"use client";

import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntentUrgency } from "@/domains/customer/intent-types";

type ReviewStepProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  pending: boolean;
  isAuthenticated: boolean;
  categoryLabel: string;
  intentText: string;
  cityLabel: string;
  locationText: string;
  urgency: IntentUrgency;
  photosCount: number;
  onEdit: () => void;
  onPublish: () => void;
};

/** Publish/review step UI (named ReviewStep per sprint layout). */
export function ReviewStep({
  t,
  pending,
  isAuthenticated,
  categoryLabel,
  intentText,
  cityLabel,
  locationText,
  urgency,
  photosCount,
  onEdit,
  onPublish,
}: ReviewStepProps) {
  return (
    <section className="space-y-5 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6 animate-fade-in-up">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.publish.reviewTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("steps.publish.reviewSubtitle")}</p>
      </div>

      <dl className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 px-4 py-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("steps.publish.fields.category")}</dt>
          <dd className="font-medium text-end">{categoryLabel || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-border/50 pt-3">
          <dt className="text-muted-foreground">{t("steps.publish.fields.problem")}</dt>
          <dd className="max-w-[65%] text-end font-medium leading-relaxed">{intentText.trim()}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-border/50 pt-3">
          <dt className="text-muted-foreground">{t("steps.publish.fields.location")}</dt>
          <dd className="text-end font-medium">
            {cityLabel}
            {locationText.trim() ? ` · ${locationText.trim()}` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-border/50 pt-3">
          <dt className="text-muted-foreground">{t("steps.publish.fields.urgency")}</dt>
          <dd className="font-medium">
            {urgency === "emergency"
              ? t("steps.urgency.emergency")
              : t("steps.urgency.normal")}
          </dd>
        </div>
        {photosCount > 0 ? (
          <div className="flex justify-between gap-3 border-t border-border/50 pt-3">
            <dt className="text-muted-foreground">{t("steps.publish.fields.photos")}</dt>
            <dd className="font-medium">{t("steps.photos.count", { count: photosCount })}</dd>
          </div>
        ) : null}
      </dl>

      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li>{t("trust.relevantOnly")}</li>
        <li>{t("trust.youControl")}</li>
      </ul>

      {!isAuthenticated && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          {t("steps.publish.loginRequired")}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-xl gap-2"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" aria-hidden />
          {t("steps.publish.edit")}
        </Button>
        <Button
          type="button"
          className="min-h-11 flex-1 rounded-xl"
          disabled={pending}
          onClick={onPublish}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : t("steps.publish.cta")}
        </Button>
      </div>
    </section>
  );
}
