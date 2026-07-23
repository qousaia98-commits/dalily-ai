"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { VisionImagePreview } from "@/components/search/vision-image-preview";
import { analyzeVisionProblemAction } from "@/actions/vision.actions";
import {
  extractImageFileFromClipboard,
  extractImageFilesFromDataTransfer,
  prepareVisionImage,
  revokeVisionPreview,
  type VisionLocalImage,
} from "@/lib/vision/client-upload";
import type { VisionPipelineDecision } from "@/lib/vision/types";
import type { ProblemId } from "@/lib/search/engine/types";
import { cn } from "@/lib/utils";

export type VisionAnalyzeSuccess = {
  decision: VisionPipelineDecision;
  diagnosisProblemId: ProblemId | null;
};

type Props = {
  onAnalyzed: (result: VisionAnalyzeSuccess) => void;
  onError?: (message: string) => void;
  className?: string;
  compact?: boolean;
};

type LocalError =
  | "invalid_file_type"
  | "file_too_large"
  | "duplicate"
  | "unsupported"
  | "analysis_failed"
  | "no_image";

export function VisionUploadControl({
  onAnalyzed,
  onError,
  className,
  compact = false,
}: Props) {
  const t = useTranslations("search.vision");
  const inputId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<VisionLocalImage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<LocalError | null>(null);
  const fingerprintsRef = useRef<string[]>([]);

  const clearImage = useCallback(() => {
    setImage((prev) => {
      revokeVisionPreview(prev);
      return null;
    });
    fingerprintsRef.current = [];
  }, []);

  useEffect(() => () => clearImage(), [clearImage]);

  const reportError = useCallback(
    (code: LocalError) => {
      setLocalError(code);
      onError?.(t(`errors.${code}`));
    },
    [onError, t],
  );

  const ingestFile = useCallback(
    async (file: File, { autoAnalyze = true }: { autoAnalyze?: boolean } = {}) => {
      setLocalError(null);
      const prepared = await prepareVisionImage(file, fingerprintsRef.current);
      if (!prepared.success) {
        reportError(prepared.error);
        return;
      }

      setImage((prev) => {
        revokeVisionPreview(prev);
        return prepared.image;
      });
      fingerprintsRef.current = [prepared.image.fingerprint];

      if (!autoAnalyze) return;

      setAnalyzing(true);
      try {
        const formData = new FormData();
        formData.set("image", prepared.image.file, prepared.image.file.name || "problem.webp");
        const result = await analyzeVisionProblemAction(formData);

        if (!result.success) {
          reportError(result.error);
          return;
        }

        onAnalyzed({
          decision: result.decision,
          diagnosisProblemId: result.diagnosisProblemId,
        });
      } finally {
        setAnalyzing(false);
      }
    },
    [onAnalyzed, reportError],
  );

  const onFileInput = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void ingestFile(file);
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = extractImageFileFromClipboard(event.clipboardData);
      if (file) {
        event.preventDefault();
        void ingestFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestFile]);

  return (
    <div className={cn("w-full space-y-3", className)}>
      {!image ? (
        <div
          role="group"
          aria-label={t("dropzoneLabel")}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const files = extractImageFilesFromDataTransfer(e.dataTransfer);
            if (files[0]) void ingestFile(files[0]);
          }}
          className={cn(
            "rounded-2xl border border-dashed border-border/80 bg-card/60 p-3 transition",
            dragOver && "border-primary bg-primary/5",
            compact ? "p-2" : "p-3",
          )}
        >
          <p className="mb-2 text-center text-xs text-muted-foreground sm:text-sm">
            {t("hint")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2 rounded-xl"
              onClick={() => cameraRef.current?.click()}
              aria-label={t("camera")}
            >
              <Camera className="size-4" aria-hidden />
              {t("camera")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2 rounded-xl"
              onClick={() => galleryRef.current?.click()}
              aria-label={t("gallery")}
            >
              <ImagePlus className="size-4" aria-hidden />
              {t("gallery")}
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("pasteHint")}</p>
        </div>
      ) : (
        <VisionImagePreview
          image={image}
          analyzing={analyzing}
          onRemove={clearImage}
          onReplace={() => galleryRef.current?.click()}
          onRetake={() => cameraRef.current?.click()}
        />
      )}

      {analyzing ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("analyzing")}
        </p>
      ) : null}

      {localError ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${localError}`)}
        </p>
      ) : null}

      <input
        ref={galleryRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          onFileInput(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          onFileInput(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
