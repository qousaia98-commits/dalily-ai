"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPublicVerificationSummaryAction } from "@/actions/public-verification.actions";
import type { PublicVerificationSummary } from "@/lib/verification/public-types";
import { formatDateTime } from "@/lib/format/datetime";
import { InlinePanelSkeleton } from "@/components/shared/skeletons";
import { cn } from "@/lib/utils";

const ACCENT: Record<string, string> = {
  green:
    "bg-emerald-500/15 text-emerald-800 border-emerald-500/30 dark:text-emerald-300",
  blue: "bg-sky-500/15 text-sky-800 border-sky-500/30 dark:text-sky-300",
  purple:
    "bg-violet-500/15 text-violet-800 border-violet-500/30 dark:text-violet-300",
  gold: "bg-[var(--dalily-gold)]/15 text-[var(--dalily-navy)] border-[var(--dalily-gold)]/40",
  navy: "bg-[var(--dalily-navy)]/10 text-[var(--dalily-navy)] border-[var(--dalily-navy)]/30",
};

function accentClass(accent: string | null | undefined): string {
  return ACCENT[accent ?? "green"] ?? ACCENT.green;
}

function levelDot(accent: string): string {
  switch (accent) {
    case "blue":
      return "bg-sky-500";
    case "purple":
      return "bg-violet-500";
    case "gold":
      return "bg-[var(--dalily-gold)]";
    case "navy":
      return "bg-[var(--dalily-navy)]";
    default:
      return "bg-emerald-500";
  }
}

export function PublicVerificationBadge({
  providerId,
  verified = false,
  initialSummary = null,
  size = "sm",
  className,
  stopLinkNavigation = false,
}: {
  providerId: string;
  verified?: boolean;
  initialSummary?: PublicVerificationSummary | null;
  size?: "sm" | "md";
  className?: string;
  /** When badge sits inside a parent <a>, stop click from navigating */
  stopLinkNavigation?: boolean;
}) {
  const t = useTranslations("publicVerification");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<PublicVerificationSummary | null>(
    initialSummary,
  );
  const [pending, startTransition] = useTransition();

  const isVerified =
    verified ||
    Boolean(summary?.isVerified) ||
    Boolean(initialSummary?.isVerified);

  if (!isVerified) return null;

  const active = summary ?? initialSummary;
  const label =
    (locale === "ar"
      ? active?.highestLevelNameAr
      : active?.highestLevelNameEn) || t("badgeDefault");
  const accent = active?.accent ?? "green";

  function openPanel(e: React.MouseEvent | React.KeyboardEvent) {
    if (stopLinkNavigation) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpen(true);
    if (!summary) {
      startTransition(async () => {
        const result = await getPublicVerificationSummaryAction(providerId);
        if (result.ok) setSummary(result.summary);
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openPanel(e);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border font-semibold transition hover:opacity-90",
          size === "sm" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-1 text-xs",
          accentClass(accent),
          className,
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("openDetails", { label })}
      >
        <ShieldCheck
          className={size === "sm" ? "size-3" : "size-3.5"}
          aria-hidden
        />
        {label}
      </button>

      {open ? (
        <PublicVerificationPanel
          summary={summary}
          loading={pending && !summary}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function PublicVerificationPanel({
  summary,
  loading,
  onClose,
}: {
  summary: PublicVerificationSummary | null;
  loading: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("publicVerification");
  const locale = useLocale();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-verification-title"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--dalily-gold)]">
              {t("eyebrow")}
            </p>
            <h2
              id="public-verification-title"
              className="mt-1 text-lg font-bold text-foreground"
            >
              {t("title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={t("close")}
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{t("trustBody")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("trustOptional")}</p>

        {loading ? (
          <InlinePanelSkeleton className="mt-6" rows={4} />
        ) : !summary || summary.levels.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="mt-5 space-y-5">
            {summary.levels.map((group, idx) => (
              <section key={group.levelSlug}>
                {idx > 0 ? <hr className="mb-5 border-border" /> : null}
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <span
                    className={cn(
                      "inline-block size-2.5 rounded-full",
                      levelDot(group.accent),
                    )}
                    aria-hidden
                  />
                  {locale === "ar" ? group.nameAr : group.nameEn}
                </h3>
                <ul className="mt-3 space-y-3">
                  {group.checks.map((check) => (
                    <li key={check.typeSlug} className="flex gap-2 text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {locale === "ar" ? check.nameAr : check.nameEn}
                        </p>
                        {check.verifiedAt ? (
                          <p className="text-xs text-muted-foreground">
                            {t("verifiedOn", {
                              date: formatDateTime(check.verifiedAt, locale, {
                                dateStyle: "long",
                              }),
                            })}
                          </p>
                        ) : null}
                        {check.expirationStatus === "expired" ||
                        check.expirationStatus === "expiring_soon" ? (
                          <p
                            className={cn(
                              "mt-0.5 text-xs font-medium",
                              check.expirationStatus === "expired"
                                ? "text-destructive"
                                : "text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {t(`expiration.${check.expirationStatus}`)}
                          </p>
                        ) : check.expirationStatus === "valid" ? (
                          <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                            {t("expiration.valid")}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="mt-6 text-[0.7rem] leading-relaxed text-muted-foreground">
          {t("privacyNote")}
        </p>
      </div>
    </div>
  );
}
