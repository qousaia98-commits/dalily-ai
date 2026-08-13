"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IntentUrgency } from "@/domains/customer/intent-types";

type ScheduleStepProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  urgency: IntentUrgency;
  onUrgencyChange: (urgency: IntentUrgency) => void;
  onBack: () => void;
  onContinue: () => void;
};

/** Urgency-step UI (named ScheduleStep per sprint layout). */
export function ScheduleStep({
  t,
  urgency,
  onUrgencyChange,
  onBack,
  onContinue,
}: ScheduleStepProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("steps.urgency.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.urgency.subtitle")}</p>
      </div>
      <div className="grid gap-2">
        {(
          [
            ["emergency", t("steps.urgency.emergency")],
            ["normal", t("steps.urgency.normal")],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onUrgencyChange(value)}
            className={cn(
              "rounded-2xl border px-4 py-3.5 text-start text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              urgency === value
                ? "border-[var(--dalily-gold)] bg-[color-mix(in_oklab,var(--dalily-gold)_10%,transparent)]"
                : "border-border hover:border-primary/30",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
          {t("back")}
        </Button>
        <Button type="button" className="min-h-11 flex-1 rounded-xl" onClick={onContinue}>
          {t("continue")}
        </Button>
      </div>
    </section>
  );
}
