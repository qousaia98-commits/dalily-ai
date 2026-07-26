"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  confirmPaymentReceiptUploadAction,
  preparePaymentReceiptUploadAction,
  type PaymentInstructionsData,
} from "@/actions/subscription.actions";
import { uploadPaymentReceiptDirect } from "@/lib/payment/upload-payment-receipt";
import { validateReceiptMeta } from "@/lib/payment/receipt-storage";
import { localizeReceiptUploadError } from "@/lib/payment/localize-errors";
import { runServerAction } from "@/lib/next/server-action-recovery";
import { isPaymentConfigured } from "@/lib/payment/config";
import { Button } from "@/components/ui/button";
import { PaymentFlowStepper, type PaymentFlowStep } from "@/components/payment/payment-flow-stepper";
import { PaymentDetailsCard } from "@/components/payment/payment-details-card";
import { PaymentAlert } from "@/components/payment/payment-alert";
import { ReceiptUploadCard } from "@/components/payment/receipt-upload-card";

type SubscriptionPaymentPanelProps = {
  instructions: PaymentInstructionsData;
  onBack?: () => void;
};

/**
 * Premium subscription payment UX — same prepare/upload/confirm APIs.
 */
export function SubscriptionPaymentPanel({ instructions, onBack }: SubscriptionPaymentPanelProps) {
  const t = useTranslations("business.subscription.payment");
  const tUx = useTranslations("paymentExperience");
  const tUpload = useTranslations("paymentReceiptUpload");

  const initiallyReview =
    instructions.status === "pending_review" || instructions.hasReceipt;

  const [phase, setPhase] = useState<"transfer" | "upload" | "success">(
    initiallyReview ? "success" : "transfer",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const paymentReady = isPaymentConfigured({
    provider: "manual",
    receiver: instructions.receiver,
    account: instructions.account,
    swift: instructions.swift ?? "",
    bankName: instructions.bankName ?? "",
  });

  const steps: PaymentFlowStep[] = useMemo(() => {
    if (phase === "success" || initiallyReview) {
      return [
        { id: "review", label: tUx("steps.review"), status: "done" },
        { id: "upload", label: tUx("steps.upload"), status: "done" },
        { id: "verify", label: tUx("steps.verifySubscription"), status: "current" },
      ];
    }
    if (phase === "upload") {
      return [
        { id: "review", label: tUx("steps.review"), status: "done" },
        { id: "upload", label: tUx("steps.upload"), status: "current" },
        { id: "verify", label: tUx("steps.verifySubscription"), status: "upcoming" },
      ];
    }
    return [
      { id: "review", label: tUx("steps.review"), status: "current" },
      { id: "upload", label: tUx("steps.upload"), status: "upcoming" },
      { id: "verify", label: tUx("steps.verifySubscription"), status: "upcoming" },
    ];
  }, [phase, initiallyReview, tUx]);

  if (!paymentReady && !initiallyReview && phase !== "success") {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center animate-fade-in">
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

  function onSubmitReceipt() {
    if (!selectedFile) {
      setError(localizeReceiptUploadError(tUpload, "file_required"));
      return;
    }

    const validated = validateReceiptMeta({
      fileName: selectedFile.name,
      mimeType: selectedFile.type || "",
      size: selectedFile.size,
    });
    if (!validated.ok) {
      setError(localizeReceiptUploadError(tUpload, validated.error));
      return;
    }

    setError(null);
    setProgress(0);

    startTransition(async () => {
      const result = await uploadPaymentReceiptDirect({
        paymentId: instructions.paymentId,
        file: selectedFile,
        prepare: async (paymentId, meta) => {
          const prepared = await runServerAction(() =>
            preparePaymentReceiptUploadAction(paymentId, meta),
          );
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
        confirm: async (paymentId, meta) =>
          runServerAction(() => confirmPaymentReceiptUploadAction(paymentId, meta)),
        onProgress: (p) => setProgress(p.percent),
      });

      if (!result.success) {
        setProgress(null);
        setError(localizeReceiptUploadError(tUpload, result.error ?? "upload_failed"));
        return;
      }

      setSelectedFile(null);
      setProgress(null);
      setPhase("success");
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-fade-in overflow-x-hidden sm:max-w-xl">
      <PaymentFlowStepper title={tUx("subscriptionTitle")} steps={steps} />

      {phase === "success" || initiallyReview ? (
        <section className="space-y-5 rounded-3xl border border-emerald-500/25 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--card)_88%,#ecfdf5)_0%,var(--card)_100%)] px-5 py-8 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-7" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {tUx("successTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{tUx("successBody")}</p>
            <p className="text-sm font-medium text-foreground/80">{tUx("successNotify")}</p>
          </div>
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              className="mt-2 h-12 w-full rounded-2xl"
              onClick={onBack}
            >
              {t("backToPlans")}
            </Button>
          ) : null}
        </section>
      ) : (
        <>
          <PaymentDetailsCard
            details={{
              amount: instructions.amount,
              currency: instructions.currency,
              reference: instructions.reference,
              receiver: instructions.receiver,
              account: instructions.account,
              contextLabel: instructions.planLabel,
            }}
            compact={phase === "upload"}
          />

          {phase === "transfer" ? (
            <section className="space-y-4 rounded-3xl border border-border bg-card px-5 py-6 shadow-sm">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {tUx("transferHint")}
              </p>
              <Button
                type="button"
                className="h-12 min-h-12 w-full rounded-2xl bg-[var(--dalily-gold)] text-base font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
                onClick={() => {
                  setError(null);
                  setPhase("upload");
                }}
              >
                {tUx("transferCta")}
              </Button>
              {onBack ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-2xl"
                  onClick={onBack}
                >
                  {tUx("back")}
                </Button>
              ) : null}
            </section>
          ) : (
            <section className="space-y-4">
              <ReceiptUploadCard
                file={selectedFile}
                onFileChange={(next) => {
                  setSelectedFile(next);
                  setProgress(null);
                  setError(null);
                }}
                onError={setError}
                disabled={pending}
                loading={pending}
              />

              {error ? (
                <PaymentAlert
                  variant="error"
                  title={tUx("errorTitle")}
                  body={error || tUx("errorFallback")}
                />
              ) : null}

              {progress != null ? (
                <div className="space-y-2 rounded-2xl border border-border bg-card px-4 py-3" aria-live="polite">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>{tUx("progress")}</span>
                    <span className="tabular-nums">{progress}%</span>
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

              <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 pt-1">
                <Button
                  type="button"
                  disabled={pending || !selectedFile}
                  className="h-13 min-h-12 w-full rounded-2xl bg-[var(--dalily-navy)] text-base font-bold text-white shadow-md hover:opacity-95"
                  onClick={onSubmitReceipt}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {pending ? tUx("uploading") : tUx("submit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-2xl"
                  onClick={() => setPhase("transfer")}
                  disabled={pending}
                >
                  {tUx("back")}
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
