"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  MAX_RECEIPT_BYTES,
  validateReceiptMeta,
} from "@/lib/payment/receipt-storage";
import { localizeReceiptUploadError } from "@/lib/payment/localize-errors";
import { cn } from "@/lib/utils";

const ACCEPT =
  "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ReceiptUploadCardProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Localized message — parent should render PaymentAlert; this only notifies */
  onError?: (message: string | null) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

/**
 * Premium receipt picker — empty dropzone or compact preview card.
 * Validation via validateReceiptMeta; upload stays in the parent.
 */
export function ReceiptUploadCard({
  file,
  onFileChange,
  onError,
  disabled = false,
  loading = false,
  className,
}: ReceiptUploadCardProps) {
  const t = useTranslations("paymentReceiptUpload");
  const locale = useLocale();
  const inputId = useId();
  const cameraId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const busy = disabled || loading;
  const maxSize =
    locale === "ar"
      ? `${MAX_RECEIPT_BYTES / (1024 * 1024)} ميغابايت`
      : `${MAX_RECEIPT_BYTES / (1024 * 1024)} MB`;

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function applyFile(next: File | undefined | null) {
    onError?.(null);
    if (!next) {
      onFileChange(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      return;
    }

    const validated = validateReceiptMeta({
      fileName: next.name,
      mimeType: next.type || "",
      size: next.size,
    });
    if (!validated.ok) {
      onFileChange(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      onError?.(localizeReceiptUploadError(t, validated.error));
      return;
    }

    onFileChange(next);
  }

  function openPicker() {
    if (busy) return;
    fileInputRef.current?.click();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (busy) return;
    applyFile(e.dataTransfer.files?.[0]);
  }

  const isPdf = Boolean(
    file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name)),
  );

  return (
    <div className={cn("space-y-3", className)}>
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          applyFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        id={cameraId}
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          applyFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!file ? (
        <div
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-disabled={busy}
          aria-labelledby={`${inputId}-title`}
          aria-describedby={`${inputId}-hint`}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!busy) setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={onDrop}
          className={cn(
            "group relative flex min-h-[14rem] w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200",
            "outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/70 focus-visible:ring-offset-2",
            dragActive
              ? "border-[var(--dalily-gold)] bg-[color-mix(in_oklab,var(--dalily-gold)_16%,transparent)] scale-[1.01] shadow-md"
              : "border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_5%,var(--card))] hover:border-[var(--dalily-gold)] hover:bg-[color-mix(in_oklab,var(--dalily-gold)_10%,var(--card))] hover:shadow-sm",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <span
            className={cn(
              "flex size-16 items-center justify-center rounded-2xl bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)] shadow-sm transition-transform duration-200",
              "group-hover:scale-105",
              dragActive && "scale-110",
            )}
          >
            {loading ? (
              <Loader2 className="size-8 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-8" aria-hidden />
            )}
          </span>
          <div className="space-y-2">
            <p
              id={`${inputId}-title`}
              className="text-lg font-bold tracking-tight text-foreground"
            >
              {t("title")}
            </p>
            <p
              id={`${inputId}-hint`}
              className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground"
            >
              {t("subtitle")}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("formats")} · {t("maxSize", { size: maxSize })}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:hidden">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 gap-2 rounded-xl px-4"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <ImagePlus className="size-4" aria-hidden />
              {t("fromGallery")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 gap-2 rounded-xl px-4"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
            >
              <Camera className="size-4" aria-hidden />
              {t("fromCamera")}
            </Button>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">{t("dropHint")}</p>
        </div>
      ) : (
        <div
          className={cn(
            "rounded-3xl border border-border bg-card p-5 shadow-[0_10px_32px_-18px_rgba(11,21,38,0.28)] transition-shadow sm:p-6",
            loading && "opacity-90",
          )}
        >
          <div className="relative mx-auto w-full max-w-[9.5rem]">
            {loading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/65 backdrop-blur-[1px]">
                <Loader2
                  className="size-7 animate-spin text-[var(--dalily-gold)]"
                  aria-hidden
                />
              </div>
            ) : null}
            <div className="flex max-h-40 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/30 p-2 shadow-md">
              {previewUrl && !isPdf ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img
                  src={previewUrl}
                  alt={t("previewAlt")}
                  className="max-h-36 max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-muted-foreground">
                  <FileText className="size-8 text-[var(--dalily-gold)]" aria-hidden />
                  <p className="text-xs font-medium">{t("pdfSelected")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto mt-4 w-full min-w-0 max-w-sm space-y-1.5 text-center">
            <p
              className="truncate text-sm font-semibold text-foreground"
              title={file.name}
            >
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            <p className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {t("selectedSuccess")}
            </p>
          </div>

          <div className="mx-auto mt-5 grid w-full max-w-sm grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 rounded-xl"
              disabled={busy}
              onClick={openPicker}
            >
              {t("change")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 rounded-xl"
              disabled={busy}
              onClick={() => applyFile(null)}
            >
              {t("remove")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
