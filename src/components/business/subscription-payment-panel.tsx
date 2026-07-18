"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import {
  Building2,
  Check,
  Copy,
  CreditCard,
  FileUp,
  Hash,
  Loader2,
  Landmark,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  confirmPaymentReceiptUploadAction,
  preparePaymentReceiptUploadAction,
  type PaymentInstructionsData,
} from "@/actions/subscription.actions";
import { uploadPaymentReceiptDirect } from "@/lib/payment/upload-payment-receipt";
import { validateReceiptMeta } from "@/lib/payment/receipt-storage";
import { isPaymentConfigured } from "@/lib/payment/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubscriptionPaymentPanelProps = {
  instructions: PaymentInstructionsData;
  onBack?: () => void;
};

type CopyField = "amount" | "receiver" | "account" | "swift" | "reference";

export function SubscriptionPaymentPanel({ instructions, onBack }: SubscriptionPaymentPanelProps) {
  const t = useTranslations("business.subscription.payment");
  const [copied, setCopied] = useState<CopyField | null>(null);
  const [step, setStep] = useState<"transfer" | "upload">(
    instructions.status === "pending_review" ? "upload" : "transfer",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const paymentReady = isPaymentConfigured({
    provider: "manual",
    receiver: instructions.receiver,
    account: instructions.account,
    swift: instructions.swift ?? "",
    bankName: instructions.bankName ?? "",
  });

  const isReview = instructions.status === "pending_review" || instructions.hasReceipt;
  const receiver = instructions.receiver;
  const account = instructions.account;
  const amountText = `${instructions.amount} ${instructions.currency}`;

  if (!paymentReady && !isReview) {
    return (
      <div className="space-y-4 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
        <p className="text-sm font-semibold text-foreground">{t("notConfiguredTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("notConfiguredBody")}</p>
        {onBack ? (
          <Button type="button" variant="outline" className="min-h-11 rounded-2xl" onClick={onBack}>
            {t("back")}
          </Button>
        ) : null}
      </div>
    );
  }

  async function copyValue(field: CopyField, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied((c) => (c === field ? null : c)), 1800);
    } catch {
      setCopied(null);
    }
  }

  function onFilePicked(file: File | undefined) {
    setError(null);
    setProgress(null);
    if (!file) {
      setFileName(null);
      return;
    }

    const validated = validateReceiptMeta({
      fileName: file.name,
      mimeType: file.type || "",
      size: file.size,
    });
    if (!validated.ok) {
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      setError(t(`errors.${validated.error}`));
      return;
    }

    setFileName(file.name);
  }

  function onSubmitReceipt() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t("errors.file_required"));
      return;
    }

    const validated = validateReceiptMeta({
      fileName: file.name,
      mimeType: file.type || "",
      size: file.size,
    });
    if (!validated.ok) {
      setError(t(`errors.${validated.error}`));
      return;
    }

    setError(null);
    setProgress(0);

    startTransition(async () => {
      const result = await uploadPaymentReceiptDirect({
        paymentId: instructions.paymentId,
        file,
        prepare: async (paymentId, meta) => {
          const prepared = await preparePaymentReceiptUploadAction(paymentId, meta);
          if (!prepared.success || !prepared.upload) {
            return { success: false, error: prepared.error ?? "prepare_failed" };
          }
          return {
            success: true,
            path: prepared.upload.path,
            token: prepared.upload.token,
            signedUrl: prepared.upload.signedUrl,
          };
        },
        confirm: async (paymentId, meta) => confirmPaymentReceiptUploadAction(paymentId, meta),
        onProgress: (p) => setProgress(p.percent),
      });

      if (!result.success) {
        setProgress(null);
        setError(t(`errors.${result.error ?? "upload_failed"}`));
        return;
      }

      window.location.reload();
    });
  }

  return (
    <div className="mx-auto w-full max-w-md animate-fade-in overflow-x-hidden md:max-w-xl">
      <div className="flex w-full max-w-full flex-col gap-5">
        <header className="px-1">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
            {t("stepLabel")}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5C6478]">
            {t("subtitle", { plan: instructions.planLabel })}
          </p>
        </header>

        <section className="w-full rounded-2xl bg-[var(--dalily-navy)] px-5 py-8 text-center text-white shadow-[0_16px_40px_-18px_rgba(11,21,38,0.45)]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
            {t("planLabel")}
          </p>
          <p className="mt-1 text-lg font-bold tracking-wide">{instructions.planLabel}</p>
          <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-white/55 uppercase">
            {t("amountLabel")}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {instructions.amount}
            <span className="ms-2 text-lg font-semibold text-[var(--dalily-gold)]">
              {instructions.currency}
            </span>
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-6 h-12 min-h-12 w-full rounded-2xl bg-white/10 text-white hover:bg-white/15"
            onClick={() => copyValue("amount", amountText)}
          >
            {copied === "amount" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === "amount" ? t("copied") : t("copyAmount")}
          </Button>
        </section>

        <DetailCard
          icon={Building2}
          label={t("receiver")}
          onCopy={() => copyValue("receiver", receiver)}
          copied={copied === "receiver"}
          copyLabel={copied === "receiver" ? t("copied") : t("copy")}
        >
          <p className="truncate text-base font-semibold text-[var(--dalily-navy)]" title={receiver}>
            {receiver}
          </p>
        </DetailCard>

        <DetailCard
          icon={CreditCard}
          label={t("account")}
          onCopy={() => copyValue("account", account)}
          copied={copied === "account"}
          copyLabel={copied === "account" ? t("copied") : t("copy")}
        >
          <p className="break-all font-mono text-sm font-semibold leading-relaxed text-[var(--dalily-navy)]">
            {account}
          </p>
        </DetailCard>

        {instructions.swift ? (
          <DetailCard
            icon={Landmark}
            label={t("swift")}
            onCopy={() => copyValue("swift", instructions.swift!)}
            copied={copied === "swift"}
            copyLabel={copied === "swift" ? t("copied") : t("copy")}
          >
            <p className="font-mono text-sm font-semibold text-[var(--dalily-navy)]">{instructions.swift}</p>
          </DetailCard>
        ) : null}

        <DetailCard
          icon={Hash}
          label={t("reference")}
          onCopy={() => copyValue("reference", instructions.reference)}
          copied={copied === "reference"}
          copyLabel={copied === "reference" ? t("copied") : t("copyReference")}
          emphasizeCopy
        >
          <div className="w-full overflow-hidden rounded-xl bg-[var(--dalily-navy)]/5 px-3 py-2.5">
            <p className="break-all font-mono text-sm font-bold tracking-wide text-[var(--dalily-navy)] sm:text-base">
              {instructions.reference}
            </p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#5C6478]">{t("referenceNotice")}</p>
        </DetailCard>

        {isReview ? (
          <section className="w-full rounded-2xl border border-[var(--dalily-gold)]/40 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)] px-5 py-6 text-center shadow-sm">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]">
              <Loader2 className="size-5 animate-spin" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-[var(--dalily-navy)]">{t("reviewTitle")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5C6478]">{t("reviewBody")}</p>
            {onBack ? (
              <Button type="button" variant="outline" className="mt-5 h-12 w-full rounded-2xl" onClick={onBack}>
                {t("backToPlans")}
              </Button>
            ) : null}
          </section>
        ) : step === "transfer" ? (
          <section className="w-full rounded-2xl border border-[#E8ECF2] bg-white px-5 py-6 shadow-sm">
            <p className="text-sm leading-relaxed text-[#5C6478]">{t("instructions")}</p>
            <Button
              type="button"
              className="mt-5 h-12 min-h-12 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
              onClick={() => setStep("upload")}
            >
              {t("transferDone")}
            </Button>
          </section>
        ) : (
          <section className="w-full rounded-2xl border border-[#E8ECF2] bg-white px-5 py-6 shadow-sm">
            <h3 className="text-lg font-bold text-[var(--dalily-navy)]">{t("uploadTitle")}</h3>
            <p className="mt-2 text-sm text-[#5C6478]">{t("uploadHint")}</p>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={(e) => onFilePicked(e.target.files?.[0])}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="mt-5 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--dalily-gold)]/50 bg-[#FBF8F0] px-4 text-sm text-[var(--dalily-navy)] transition hover:bg-[#F7F1E4] disabled:opacity-60"
            >
              <FileUp className="size-6 text-[var(--dalily-gold)]" />
              <span className="font-semibold">{fileName ?? t("chooseFile")}</span>
              <span className="text-xs text-muted-foreground">{t("fileTypes")}</span>
            </button>

            {progress != null ? (
              <div className="mt-4 space-y-2" aria-live="polite">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>{t("uploadProgress")}</span>
                  <span>{progress}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className="h-full rounded-full bg-[var(--dalily-gold)] transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              disabled={pending || !fileName}
              className="mt-5 h-12 min-h-12 w-full rounded-2xl bg-[var(--dalily-navy)] font-bold text-white"
              onClick={onSubmitReceipt}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {pending ? t("uploading") : t("submitReceipt")}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-12 w-full rounded-2xl"
              onClick={() => setStep("transfer")}
              disabled={pending}
            >
              {t("backToTransfer")}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  label,
  children,
  onCopy,
  copied,
  copyLabel,
  emphasizeCopy = false,
}: {
  icon: typeof Building2;
  label: string;
  children: ReactNode;
  onCopy: () => void;
  copied: boolean;
  copyLabel: string;
  emphasizeCopy?: boolean;
}) {
  return (
    <section className="flex w-full max-w-full flex-col gap-4 rounded-2xl border border-[#E8ECF2] bg-white px-5 py-6 shadow-[0_10px_28px_-16px_rgba(11,21,38,0.18)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dalily-navy)]/5 text-[var(--dalily-navy)]">
          <Icon className="size-4" />
        </span>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      </div>
      <div className="min-w-0 w-full overflow-hidden">{children}</div>
      <Button
        type="button"
        variant={emphasizeCopy ? "default" : "outline"}
        className={cn(
          "h-12 min-h-12 w-full rounded-2xl font-semibold",
          emphasizeCopy &&
            "bg-[var(--dalily-gold)] text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]",
        )}
        onClick={onCopy}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copyLabel}
      </Button>
    </section>
  );
}
