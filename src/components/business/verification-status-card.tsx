"use client";

import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileWarning,
  Hourglass,
  ShieldAlert,
} from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VerificationAdminFeedback } from "@/lib/verification/feedback";
import type { VerificationUiStatus } from "@/lib/verification/feedback";

export type { VerificationUiStatus };

type Props = {
  status: VerificationUiStatus;
  feedback?: VerificationAdminFeedback | null;
  /** Show action button when relevant */
  showAction?: boolean;
  /** Compact for embedding in forms */
  compact?: boolean;
  className?: string;
  href?: string;
};

const ICONS = {
  draft: Hourglass,
  pending_review: Clock3,
  approved: CheckCircle2,
  rejected: AlertCircle,
  changes_requested: FileWarning,
  expired: ShieldAlert,
} as const;

const TONE: Record<VerificationUiStatus, string> = {
  draft: "border-border bg-card",
  pending_review: "border-sky-500/30 bg-sky-500/10",
  approved: "border-emerald-500/30 bg-emerald-500/10",
  rejected: "border-destructive/30 bg-destructive/10",
  changes_requested: "border-amber-500/35 bg-amber-500/10",
  expired: "border-border bg-muted/40",
};

const ICON_TONE: Record<VerificationUiStatus, string> = {
  draft: "text-muted-foreground",
  pending_review: "text-sky-600",
  approved: "text-emerald-600",
  rejected: "text-destructive",
  changes_requested: "text-amber-700",
  expired: "text-muted-foreground",
};

/**
 * Reusable verification status — colors, icons, why/next/action, optional CTA.
 */
export function VerificationStatusCard({
  status,
  feedback = null,
  showAction = true,
  compact = false,
  className,
  href = "/business/verification",
}: Props) {
  const t = useTranslations("business.verification.statusCard");
  const Icon = ICONS[status];

  const actionKey =
    status === "rejected"
      ? "uploadAgain"
      : status === "changes_requested"
        ? "continue"
        : status === "draft"
          ? "continue"
          : null;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        TONE[status],
        compact && "p-4",
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0", ICON_TONE[status])} aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-foreground">{t(`${status}.title`)}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(`${status}.why`)}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(`${status}.next`)}
          </p>
          <p className="text-sm font-medium text-foreground">{t(`${status}.action`)}</p>

          {feedback && (status === "rejected" || status === "changes_requested") ? (
            <div className="mt-2 space-y-2 rounded-xl border border-border/70 bg-background/70 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("reasonLabel")}
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{feedback.reason}</p>
              {feedback.note ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("noteLabel")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{feedback.note}</p>
                </>
              ) : null}
              {feedback.recommendation ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("recommendationLabel")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {feedback.recommendation}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}

          {showAction && actionKey ? (
            <Button
              asChild
              className={cn(
                "mt-3 h-11 min-h-11 w-full rounded-2xl sm:w-auto",
                status === "rejected" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                status === "changes_requested" &&
                  "bg-amber-600 text-white hover:bg-amber-700",
                status === "draft" &&
                  "bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]",
              )}
            >
              <Link href={href}>{t(`cta.${actionKey}`)}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
