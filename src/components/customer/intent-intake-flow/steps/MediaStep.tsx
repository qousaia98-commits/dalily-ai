"use client";

import { Camera, Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { VisionInsightState } from "../types";

type MediaStepProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  photos: File[];
  visionPending: boolean;
  visionError: string | null;
  visionInsight: VisionInsightState | null;
  showVisionCorrection: boolean;
  visionCorrection: string;
  onPhotosChange: (files: File[]) => void;
  onConfirmVision: () => void;
  onShowCorrection: () => void;
  onVisionCorrectionChange: (value: string) => void;
  onSaveCorrection: () => void;
  onCancelCorrection: () => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
};

/** Photos + vision step UI (named MediaStep per sprint layout). */
export function MediaStep({
  t,
  locale,
  photos,
  visionPending,
  visionError,
  visionInsight,
  showVisionCorrection,
  visionCorrection,
  onPhotosChange,
  onConfirmVision,
  onShowCorrection,
  onVisionCorrectionChange,
  onSaveCorrection,
  onCancelCorrection,
  onBack,
  onSkip,
  onContinue,
}: MediaStepProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("steps.photos.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.photos.subtitle")}</p>
      </div>
      <Label
        htmlFor="photos"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground transition hover:border-[var(--dalily-gold)]/50 hover:bg-muted/20"
      >
        <Camera className="size-6" aria-hidden />
        {t("steps.photos.add")}
        <input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 5);
            onPhotosChange(files);
          }}
        />
      </Label>
      {photos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("steps.photos.count", { count: photos.length })}
        </p>
      )}

      {visionPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("steps.photos.analyzing")}
        </p>
      )}

      {visionError && (
        <p className="text-sm text-muted-foreground">{visionError}</p>
      )}

      {visionInsight && !visionPending && (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("steps.photos.aiSummary")}
          </p>
          <p className="text-sm font-medium">
            {locale === "ar" ? visionInsight.summaryAr : visionInsight.summaryEn}
          </p>
          {visionInsight.contradiction && visionInsight.confirmed == null && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("steps.photos.clarifyMismatch")}
            </p>
          )}
          {visionInsight.confirmed === true && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5" aria-hidden />
              {t("steps.photos.confirmed")}
            </p>
          )}
          {visionInsight.confirmed == null && !showVisionCorrection && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={onConfirmVision}
              >
                {t("steps.photos.confirm")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={onShowCorrection}
              >
                <Pencil className="size-3.5 me-1" aria-hidden />
                {t("steps.photos.correct")}
              </Button>
            </div>
          )}
          {showVisionCorrection && (
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={visionCorrection}
                onChange={(e) => onVisionCorrectionChange(e.target.value)}
                placeholder={t("steps.photos.correctionPlaceholder")}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  onClick={onSaveCorrection}
                >
                  {t("steps.photos.saveCorrection")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={onCancelCorrection}
                >
                  {t("steps.photos.cancelCorrection")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
          {t("back")}
        </Button>
        <Button type="button" variant="secondary" className="flex-1 rounded-xl" onClick={onSkip}>
          {t("steps.photos.skip")}
        </Button>
        <Button
          type="button"
          className="flex-1 rounded-xl"
          onClick={onContinue}
          disabled={visionPending}
        >
          {t("continue")}
        </Button>
      </div>
    </section>
  );
}
