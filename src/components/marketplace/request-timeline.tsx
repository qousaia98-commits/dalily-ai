"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  buildTimeline,
  type ServiceRequestStatus,
  type TimelineStepId,
} from "@/lib/service-requests/status-machine";

type Props = {
  status: ServiceRequestStatus;
  hasQuote?: boolean;
  className?: string;
  compact?: boolean;
};

export function RequestTimeline({ status, hasQuote, className, compact }: Props) {
  const t = useTranslations("marketplace.timeline");
  const steps = buildTimeline(status, { hasQuote });

  return (
    <ol
      className={cn(
        "relative space-y-0",
        compact ? "ps-0" : "ps-1",
        className,
      )}
      aria-label={t("label")}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  "absolute start-[0.7rem] top-7 h-[calc(100%-1.25rem)] w-0.5",
                  step.state === "done"
                    ? "bg-[var(--dalily-gold)]"
                    : step.state === "skipped"
                      ? "bg-border/50"
                      : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-bold transition",
                step.state === "done" &&
                  "border-[var(--dalily-gold)] bg-[var(--dalily-gold)] text-[var(--dalily-navy)]",
                step.state === "current" &&
                  "border-[var(--dalily-gold)] bg-[color-mix(in_oklab,var(--dalily-gold)_18%,var(--card))] text-[var(--dalily-navy)] ring-4 ring-[color-mix(in_oklab,var(--dalily-gold)_20%,transparent)] motion-safe:animate-pulse",
                step.state === "upcoming" && "border-border bg-card text-muted-foreground",
                step.state === "skipped" && "border-border/40 bg-muted/40 text-muted-foreground/50",
              )}
            >
              {step.state === "done" ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  step.state === "current" && "text-foreground",
                  step.state === "done" && "text-foreground",
                  step.state === "upcoming" && "text-muted-foreground",
                  step.state === "skipped" && "text-muted-foreground/50 line-through",
                )}
              >
                {t(step.id as TimelineStepId)}
              </p>
              {step.state === "current" ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{t("currentHint")}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
