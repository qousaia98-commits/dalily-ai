"use client";

import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type VerificationDisplayStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected";

type Props = {
  status: VerificationDisplayStatus;
  rejectionReason?: string | null;
  className?: string;
};

/**
 * Clear verification status with why / next / what to do — no generic fluff.
 */
export function VerificationStatusPanel({ status, rejectionReason, className }: Props) {
  const t = useTranslations("business.verification.statusPanel");

  const Icon =
    status === "approved" ? CheckCircle2 : status === "rejected" ? AlertCircle : Clock3;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        status === "approved" && "border-emerald-500/30 bg-emerald-500/10",
        status === "rejected" && "border-destructive/30 bg-destructive/10",
        status === "pending_review" && "border-border bg-muted/30",
        status === "draft" && "border-border bg-card",
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-5 shrink-0",
            status === "approved" && "text-emerald-600",
            status === "rejected" && "text-destructive",
            (status === "pending_review" || status === "draft") && "text-[var(--dalily-gold)]",
          )}
          aria-hidden
        />
        <div className="space-y-2">
          <p className="font-semibold text-foreground">{t(`${status}.title`)}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(`${status}.why`)}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(`${status}.next`)}</p>
          <p className="text-sm font-medium text-foreground">{t(`${status}.action`)}</p>
          {status === "rejected" && rejectionReason ? (
            <p className="rounded-xl border border-destructive/20 bg-background/60 px-3 py-2 text-sm text-destructive">
              {rejectionReason}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
