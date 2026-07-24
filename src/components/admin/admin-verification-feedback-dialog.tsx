"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { VerificationAdminFeedback } from "@/lib/verification/feedback";
import { cn } from "@/lib/utils";

type Mode = "reject" | "changes";

type Props = {
  open: boolean;
  mode: Mode;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (feedback: VerificationAdminFeedback) => Promise<void> | void;
};

const PRESETS = [
  "blurry",
  "backMissing",
  "selfieMissing",
  "expired",
  "unreadable",
] as const;

/**
 * Admin reject / changes dialog with reason, note, recommendation + live notification preview.
 */
export function AdminVerificationFeedbackDialog({
  open,
  mode,
  pending = false,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations("admin.verificationFeedback");
  const tn = useTranslations("notifications");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [localPending, startTransition] = useTransition();
  const busy = pending || localPending;

  const preview = useMemo(() => {
    const combined = [reason.trim(), note.trim(), recommendation.trim()]
      .filter(Boolean)
      .join("\n\n");
    if (mode === "reject") {
      return {
        title: tn("verificationRejected.title"),
        body: tn("verificationRejected.body"),
        reason: combined,
      };
    }
    return {
      title: tn("verificationChangesRequested.title"),
      body: tn("verificationChangesRequested.body"),
      reason: combined,
    };
  }, [mode, note, reason, recommendation, tn]);

  if (!open) return null;

  function submit() {
    if (reason.trim().length < 3) return;
    startTransition(async () => {
      await onSubmit({
        reason: reason.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(recommendation.trim() ? { recommendation: recommendation.trim() } : {}),
      });
      setReason("");
      setNote("");
      setRecommendation("");
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-feedback-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-background p-5 shadow-xl sm:p-6"
      >
        <h3 id="verification-feedback-title" className="text-lg font-bold text-[var(--dalily-navy)]">
          {mode === "reject" ? t("rejectTitle") : t("changesTitle")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "reject" ? t("rejectBody") : t("changesBody")}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((key) => (
            <button
              key={key}
              type="button"
              className="min-h-10 rounded-full border border-border bg-muted/40 px-3 text-xs font-medium hover:border-[var(--dalily-gold)]/50"
              onClick={() => setReason(t(`presets.${key}`))}
            >
              {t(`presets.${key}`)}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vf-reason">{t("reason")} *</Label>
            <textarea
              id="vf-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              minLength={3}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
              placeholder={t("reasonPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vf-note">{t("note")}</Label>
            <textarea
              id="vf-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
              placeholder={t("notePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vf-rec">{t("recommendation")}</Label>
            <textarea
              id="vf-rec"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
              placeholder={t("recommendationPlaceholder")}
            />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--dalily-gold)]/30 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,white)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("previewLabel")}
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{preview.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{preview.body}</p>
          {preview.reason ? (
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm">
              {preview.reason}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-2xl"
            disabled={busy}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className={cn(
              "h-11 flex-1 rounded-2xl",
              mode === "reject" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
            disabled={busy || reason.trim().length < 3}
            onClick={submit}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : t("submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
