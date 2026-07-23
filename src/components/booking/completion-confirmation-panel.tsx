"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  customerConfirmCompletionAction,
  customerReportIssueAction,
} from "@/actions/booking.actions";
import { BOOKING_ISSUE_REASONS, type Booking } from "@/lib/booking/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  booking: Booking;
};

export function CompletionConfirmationPanel({ booking }: Props) {
  const t = useTranslations("booking.completion");
  const locale = useLocale();
  const router = useRouter();
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsPrompt =
    booking.status === "awaiting_customer_confirmation" ||
    (booking.status === "confirmed" && new Date(booking.endsAt).getTime() <= Date.now());

  if (!needsPrompt && booking.status !== "issue_reported") return null;

  if (booking.status === "issue_reported") {
    return (
      <section
        className="space-y-3 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-4"
        aria-labelledby="issue-reported-title"
      >
        <h2 id="issue-reported-title" className="text-base font-bold">
          {t("issueReportedTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("issueReportedBody")}</p>
        {booking.issueReason ? (
          <p className="text-sm font-medium">{t(`reasons.${booking.issueReason}`)}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {booking.conversationId ? (
            <Button asChild variant="outline" className="min-h-11 rounded-xl">
              <a href={`/${locale}/messages/${booking.conversationId}`}>{t("continueChat")}</a>
            </Button>
          ) : null}
          <Button
            type="button"
            className="min-h-11 rounded-xl"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await customerConfirmCompletionAction(booking.id);
                if (!result.success) {
                  setError(result.error ?? "update_failed");
                  return;
                }
                if (result.serviceRequestId) {
                  router.push(`/account/requests/${result.serviceRequestId}`);
                } else {
                  router.refresh();
                }
              });
            }}
          >
            {t("confirmAnyway")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="space-y-4 rounded-3xl border border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] p-4"
      aria-labelledby="completion-title"
    >
      <div>
        <h2 id="completion-title" className="text-base font-bold">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">{t("title")}</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
          <input
            type="radio"
            name={`completion-${booking.id}`}
            value="yes"
            checked={answer === "yes"}
            onChange={() => {
              setAnswer("yes");
              setReason("");
            }}
            className="size-5"
          />
          <span className="text-sm font-medium">{t("yes")}</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
          <input
            type="radio"
            name={`completion-${booking.id}`}
            value="no"
            checked={answer === "no"}
            onChange={() => setAnswer("no")}
            className="size-5"
          />
          <span className="text-sm font-medium">{t("no")}</span>
        </label>
      </fieldset>

      {answer === "no" ? (
        <div className="space-y-2">
          <Label id={`reason-label-${booking.id}`}>{t("whatHappened")}</Label>
          <div
            className="grid gap-2"
            role="listbox"
            aria-labelledby={`reason-label-${booking.id}`}
          >
            {BOOKING_ISSUE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="option"
                aria-selected={reason === r}
                className={`min-h-11 rounded-2xl border px-3 py-2 text-start text-sm transition-colors ${
                  reason === r
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
                onClick={() => setReason(r)}
              >
                {t(`reasons.${r}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${error}` as "errors.update_failed")}
        </p>
      ) : null}

      <Button
        type="button"
        className="min-h-12 w-full rounded-2xl"
        disabled={pending || !answer || (answer === "no" && !reason)}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            if (answer === "yes") {
              const result = await customerConfirmCompletionAction(booking.id);
              if (!result.success) {
                setError(result.error ?? "update_failed");
                return;
              }
              if (result.serviceRequestId) {
                router.push(`/account/requests/${result.serviceRequestId}`);
                return;
              }
              router.refresh();
              return;
            }
            const result = await customerReportIssueAction(booking.id, reason);
            if (!result.success) {
              setError(result.error ?? "update_failed");
              return;
            }
            router.refresh();
          });
        }}
      >
        {t("submit")}
      </Button>
    </section>
  );
}
