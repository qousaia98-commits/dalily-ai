"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentAlertProps = {
  variant: "error" | "success";
  title: string;
  body?: string;
  className?: string;
};

/**
 * Contained alert card — never floating raw text.
 */
export function PaymentAlert({ variant, title, body, className }: PaymentAlertProps) {
  const isError = variant === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "flex gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm animate-fade-in",
        isError
          ? "border-destructive/35 bg-destructive/8 text-destructive"
          : "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
        className,
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {isError ? (
          <AlertTriangle className="size-5" />
        ) : (
          <CheckCircle2 className="size-5" />
        )}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold leading-snug text-current">{title}</p>
        {body ? (
          <p
            className={cn(
              "leading-relaxed",
              isError ? "text-destructive/90" : "text-emerald-700/90 dark:text-emerald-200/90",
            )}
          >
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}
