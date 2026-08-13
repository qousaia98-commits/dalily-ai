"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type PaymentFlowStep = {
  id: string;
  label: string;
  status: "done" | "current" | "upcoming";
};

type PaymentFlowStepperProps = {
  title: string;
  steps: PaymentFlowStep[];
  className?: string;
};

/**
 * Vertical premium step guide for manual payment flows.
 */
export function PaymentFlowStepper({ title, steps, className }: PaymentFlowStepperProps) {
  const t = useTranslations("paymentExperience");

  return (
    <div className={cn("space-y-5", className)}>
      <header className="space-y-1">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
          {t("brand")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
          <span className="me-2" aria-hidden>
            💳
          </span>
          {title}
        </h1>
      </header>

      <ol className="relative space-y-0" aria-label={title}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast ? (
                <span
                  className={cn(
                    "absolute start-[0.85rem] top-8 h-[calc(100%-1.25rem)] w-px",
                    step.status === "done"
                      ? "bg-[var(--dalily-gold)]/50"
                      : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                  step.status === "done" &&
                    "border-[var(--dalily-gold)] bg-[var(--dalily-gold)] text-[var(--dalily-navy)]",
                  step.status === "current" &&
                    "border-[var(--dalily-gold)] bg-[color-mix(in_oklab,var(--dalily-gold)_18%,transparent)] text-foreground ring-4 ring-[var(--dalily-gold)]/15",
                  step.status === "upcoming" &&
                    "border-border bg-muted/40 text-muted-foreground",
                )}
                aria-hidden
              >
                {step.status === "done" ? <Check className="size-3.5" strokeWidth={3} /> : null}
                {step.status === "current" ? (
                  <span className="size-2 rounded-full bg-[var(--dalily-gold)]" />
                ) : null}
                {step.status === "upcoming" ? (
                  <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                ) : null}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("stepLabel", { n: index + 1 })}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold leading-snug",
                    step.status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {step.label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
