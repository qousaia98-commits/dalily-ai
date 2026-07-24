"use client";

/**
 * Shared verification document upload with automatic compress/resize before upload.
 * Reuses compressImageFile — no verification logic changes.
 */

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Camera, CheckCircle2, ImagePlus, Loader2, Upload } from "lucide-react";
import {
  uploadVerificationDocumentAction,
  type VerificationActionState,
} from "@/actions/verification.actions";
import { compressImageFile } from "@/lib/media/compress-image";
import { FieldError } from "@/components/forms/field-error";
import { useClientFormValidation } from "@/hooks/use-client-form-validation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initial: VerificationActionState = { success: false };

type ProgressPhase = "idle" | "preparing" | "optimizing" | "uploading" | "done";

type Props = {
  label: string;
  docType: "id_front" | "id_back" | "selfie";
  providerId: string;
  uploaded: boolean;
  disabled: boolean;
  variant?: "onboarding" | "page";
  className?: string;
};

function mapUploadErrorCode(code: string | undefined): "friendly_large" | "invalid_file_type" | "file_required" | "upload_failed" {
  if (code === "file_too_large") return "friendly_large";
  if (code === "invalid_file_type") return "invalid_file_type";
  if (code === "file_required") return "file_required";
  return "upload_failed";
}

export function VerificationDocUpload({
  label,
  docType,
  providerId,
  uploaded,
  disabled,
  variant = "page",
  className,
}: Props) {
  const t = useTranslations("business.verification");
  const to = useTranslations("business.onboarding.identity");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(uploadVerificationDocumentAction, initial);
  const [progress, setProgress] = useState<ProgressPhase>("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const formId = `verify-doc-${docType}`;
  const { fieldErrors, getFieldA11y, clearFieldError } = useClientFormValidation({ formId });

  useEffect(() => {
    if (state.success) {
      setProgress("done");
      router.refresh();
    }
  }, [state.success, router]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    setLocalError(null);
    clearFieldError("file");
    setProgress("preparing");

    try {
      setProgress("optimizing");
      let compressed = await compressImageFile(file, {
        maxEdge: 1600,
        quality: 0.82,
        preferWebp: true,
      });

      // Phone photos must never fail on size — retry more aggressively if still large.
      if (compressed.file.size > 4_500_000) {
        compressed = await compressImageFile(compressed.file, {
          maxEdge: 1280,
          quality: 0.72,
          preferWebp: true,
        });
      }
      if (compressed.file.size > 4_500_000) {
        compressed = await compressImageFile(compressed.file, {
          maxEdge: 1024,
          quality: 0.65,
          preferWebp: false,
        });
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(compressed.file));

      setProgress("uploading");
      const fd = new FormData();
      fd.set("docType", docType);
      fd.set("providerId", providerId);
      fd.set("file", compressed.file, compressed.file.name);

      startTransition(() => {
        formAction(fd);
      });
    } catch {
      setProgress("idle");
      setLocalError(t("errors.upload_failed"));
    }
  }

  const busy =
    pending || progress === "preparing" || progress === "optimizing" || progress === "uploading";
  const progressLabel =
    progress === "preparing"
      ? t("progress.preparing")
      : progress === "optimizing"
        ? t("progress.optimizing")
        : progress === "uploading"
          ? t("progress.uploading")
          : progress === "done" || uploaded
            ? t("progress.submitted")
            : null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-border/80 bg-card p-4 transition-colors",
        variant === "onboarding" && "shadow-sm",
        dragOver && "border-[var(--dalily-gold)] bg-[color-mix(in_oklab,var(--dalily-gold)_8%,white)]",
        className,
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled && !uploaded) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !uploaded) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled || uploaded) return;
        const file = e.dataTransfer.files?.[0];
        void handleFile(file);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold">{label}</Label>
        {uploaded ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {variant === "onboarding" ? to("uploaded") : t("uploaded")}
          </span>
        ) : null}
      </div>

      {previewUrl && !uploaded ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt=""
          className="h-28 w-full rounded-xl object-cover"
        />
      ) : null}

      {!uploaded ? (
        <>
          <p className="hidden text-xs text-muted-foreground sm:block">{t("dropHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 gap-2 rounded-xl"
              disabled={disabled || busy}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-4" aria-hidden />
              {t("camera")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 gap-2 rounded-xl"
              disabled={disabled || busy}
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden />
              {t("gallery")}
            </Button>
          </div>
        </>
      ) : null}

      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled || busy}
        {...getFieldA11y("file")}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled || busy}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {busy || progressLabel ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {progressLabel}
        </p>
      ) : null}

      <FieldError name="file" formId={formId} message={fieldErrors.file} />
      {localError || state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {localError ?? t(`errors.${mapUploadErrorCode(state.error)}`)}
        </p>
      ) : null}
      {state.success && !uploaded ? (
        <p className="text-sm text-emerald-600">{t("uploadSuccess")}</p>
      ) : null}
    </div>
  );
}
