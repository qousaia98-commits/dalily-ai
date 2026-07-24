"use client";

import { useEffect, useState } from "react";
import { Camera, ImageIcon, Replace, Trash2, ZoomIn, X, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VisionLocalImage } from "@/lib/vision/client-upload";

type Props = {
  image: VisionLocalImage;
  analyzing?: boolean;
  onRemove: () => void;
  onReplace: () => void;
  onRetake: () => void;
  onAnalyze?: () => void;
  showAnalyze?: boolean;
  className?: string;
};

export function VisionImagePreview({
  image,
  analyzing,
  onRemove,
  onReplace,
  onRetake,
  onAnalyze,
  showAnalyze = false,
  className,
}: Props) {
  const t = useTranslations("search.vision");
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOpen]);

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border/80 bg-muted/40",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral blob URL */}
        <img
          src={image.previewUrl}
          alt={t("previewAlt")}
          loading="lazy"
          className={cn("h-40 w-full object-cover sm:h-48", analyzing && "opacity-60")}
        />

        {analyzing ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-background/50 text-sm font-medium"
            role="status"
            aria-live="polite"
          >
            {t("analyzing")}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border/70 bg-card/90 p-2.5 backdrop-blur-sm">
          {showAnalyze && onAnalyze ? (
            <Button
              type="button"
              size="sm"
              className="min-h-11 flex-1 gap-1.5 rounded-xl sm:flex-none"
              onClick={onAnalyze}
              disabled={analyzing}
              aria-label={t("analyze")}
            >
              <Sparkles className="size-4" aria-hidden />
              {t("analyze")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 rounded-xl"
            onClick={onReplace}
            disabled={analyzing}
            aria-label={t("replace")}
          >
            <Replace className="size-4" aria-hidden />
            {t("replace")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 rounded-xl"
            onClick={onRetake}
            disabled={analyzing}
            aria-label={t("retake")}
          >
            <Camera className="size-4" aria-hidden />
            {t("retake")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 gap-1.5 rounded-xl text-destructive"
            onClick={onRemove}
            disabled={analyzing}
            aria-label={t("remove")}
          >
            <Trash2 className="size-4" aria-hidden />
            {t("remove")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 gap-1.5 rounded-xl"
            onClick={() => setZoomOpen(true)}
            aria-label={t("zoom")}
          >
            <ZoomIn className="size-4" aria-hidden />
            {t("zoom")}
          </Button>
        </div>
      </div>

      {zoomOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("zoom")}
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            className="absolute end-4 top-4 flex size-11 items-center justify-center rounded-full bg-background/90 text-foreground"
            aria-label={t("closeZoom")}
            onClick={() => setZoomOpen(false)}
          >
            <X className="size-5" aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt={t("previewAlt")}
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      <p className="sr-only">
        <ImageIcon aria-hidden />
        {t("previewHint")}
      </p>
    </>
  );
}
