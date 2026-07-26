"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  cancelUnlockFeePaymentAction,
  confirmUnlockDevBypassAction,
  declineUnlockAction,
  startUnlockFeePaymentAction,
} from "@/actions/unlock.actions";
import type { UnlockSessionView } from "@/domains/unlock/types";
import type { UnlockFeePaymentView } from "@/domains/payment/unlock-fee";
import {
  confirmPaymentReceiptUploadAction,
  preparePaymentReceiptUploadAction,
} from "@/actions/subscription.actions";
import { uploadPaymentReceiptDirect } from "@/lib/payment/upload-payment-receipt";
import { validateReceiptMeta } from "@/lib/payment/receipt-storage";
import {
  localizeReceiptUploadError,
  localizeUnlockFlowError,
} from "@/lib/payment/localize-errors";
import { runServerAction } from "@/lib/next/server-action-recovery";
import { PaymentFlowStepper, type PaymentFlowStep } from "@/components/payment/payment-flow-stepper";
import { PaymentDetailsCard } from "@/components/payment/payment-details-card";
import { PaymentAlert } from "@/components/payment/payment-alert";
import { ReceiptUploadCard } from "@/components/payment/receipt-upload-card";

/**
 * Premium unlock-fee payment UX — same unlock + receipt upload APIs.
 */
export function ProviderUnlockPanel({
  session,
  requestTitle,
  allowDevBypass,
  paymentsEnabled,
  initialPayment = null,
}: {
  session: UnlockSessionView;
  requestTitle: string;
  allowDevBypass: boolean;
  paymentsEnabled: boolean;
  initialPayment?: UnlockFeePaymentView | null;
}) {
  const t = useTranslations("unlockFlow");
  const tUx = useTranslations("paymentExperience");
  const tUpload = useTranslations("paymentReceiptUpload");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [payment, setPayment] = useState<UnlockFeePaymentView | null>(initialPayment);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const run = (fn: () => Promise<{ success: boolean; error?: string; payment?: UnlockFeePaymentView }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setError(localizeUnlockFlowError(t, result.error ?? "failed"));
        return;
      }
      if (result.payment) setPayment(result.payment);
      router.refresh();
    });
  };

  const open = session.status === "opened" || session.status === "payment_pending";
  const awaitingReview =
    justSubmitted ||
    payment?.status === "pending_review" ||
    Boolean(payment?.hasReceipt);
  const canUpload =
    Boolean(payment) &&
    payment?.status === "pending" &&
    !payment.hasReceipt &&
    !justSubmitted;

  const steps: PaymentFlowStep[] = useMemo(() => {
    if (session.status === "succeeded") {
      return [
        { id: "review", label: tUx("steps.review"), status: "done" },
        { id: "upload", label: tUx("steps.upload"), status: "done" },
        { id: "verify", label: tUx("steps.verify"), status: "done" },
      ];
    }
    if (awaitingReview) {
      return [
        { id: "review", label: tUx("steps.review"), status: "done" },
        { id: "upload", label: tUx("steps.upload"), status: "done" },
        { id: "verify", label: tUx("steps.verify"), status: "current" },
      ];
    }
    if (payment) {
      return [
        { id: "review", label: tUx("steps.review"), status: "done" },
        { id: "upload", label: tUx("steps.upload"), status: "current" },
        { id: "verify", label: tUx("steps.verify"), status: "upcoming" },
      ];
    }
    return [
      { id: "review", label: tUx("steps.review"), status: "current" },
      { id: "upload", label: tUx("steps.upload"), status: "upcoming" },
      { id: "verify", label: tUx("steps.verify"), status: "upcoming" },
    ];
  }, [payment, awaitingReview, session.status, tUx]);

  async function onSubmitReceipt() {
    if (!selectedFile || !payment) {
      setUploadError(localizeReceiptUploadError(tUpload, "file_required"));
      return;
    }

    const validated = validateReceiptMeta({
      fileName: selectedFile.name,
      mimeType: selectedFile.type || "",
      size: selectedFile.size,
    });
    if (!validated.ok) {
      setUploadError(localizeReceiptUploadError(tUpload, validated.error));
      return;
    }

    setError(null);
    setUploadError(null);
    setUploading(true);
    try {
      const uploaded = await uploadPaymentReceiptDirect({
        paymentId: payment.paymentId,
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
      });
      if (!uploaded.success) {
        setUploadError(localizeReceiptUploadError(tUpload, uploaded.error));
        return;
      }
      setSelectedFile(null);
      setJustSubmitted(true);
      setPayment({
        ...payment,
        status: "pending_review",
        hasReceipt: true,
      });
      router.refresh();
    } catch {
      setUploadError(localizeReceiptUploadError(tUpload, "receipt_failed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-fade-in">
      <PaymentFlowStepper title={tUx("unlockTitle")} steps={steps} />

      <p className="text-sm text-muted-foreground">{requestTitle}</p>
      <p className="text-xs text-muted-foreground">
        {t("provider.sla", { deadline: new Date(session.slaDeadline).toLocaleString() })}
      </p>
      <p className="text-sm text-muted-foreground">{t("provider.noContactUntilPay")}</p>

      {session.status === "succeeded" ? (
        <PaymentAlert variant="success" title={t("provider.succeeded")} />
      ) : null}

      {paymentsEnabled && open ? (
        <div className="space-y-5">
          {!payment ? (
            <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">
                {t("provider.fee", {
                  amount: session.feeAmount,
                  currency: session.feeCurrency,
                })}
              </p>
              <Button
                className="h-12 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)]"
                disabled={pending}
                onClick={() => run(() => startUnlockFeePaymentAction(session.id))}
              >
                {tUx("startPayment")}
              </Button>
            </section>
          ) : awaitingReview ? (
            <section className="space-y-4 rounded-3xl border border-emerald-500/25 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--card)_88%,#ecfdf5)_0%,var(--card)_100%)] px-5 py-8 text-center shadow-sm">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-7" aria-hidden />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">{tUx("successTitle")}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {tUx("successBody")}
                </p>
                <p className="text-sm font-medium">{tUx("successNotify")}</p>
              </div>
            </section>
          ) : canUpload ? (
            <>
              <PaymentDetailsCard
                details={{
                  amount: payment.amount,
                  currency: payment.currency,
                  reference: payment.reference,
                  receiver: payment.receiver || "—",
                  account: payment.account || "—",
                }}
                compact
              />

              <ReceiptUploadCard
                file={selectedFile}
                onFileChange={(next) => {
                  setSelectedFile(next);
                  setUploadError(null);
                }}
                onError={setUploadError}
                disabled={uploading || pending}
                loading={uploading}
              />

              {uploadError ? (
                <PaymentAlert
                  variant="error"
                  title={tUx("errorTitle")}
                  body={uploadError || tUx("errorFallback")}
                />
              ) : null}

              <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
                <Button
                  className="h-12 min-h-12 w-full rounded-2xl bg-[var(--dalily-navy)] text-base font-bold text-white shadow-md"
                  disabled={uploading || pending || !selectedFile}
                  onClick={() => void onSubmitReceipt()}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {uploading ? tUx("uploading") : tUx("submit")}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-2xl"
                  disabled={pending || uploading}
                  onClick={() =>
                    run(async () => {
                      const result = await cancelUnlockFeePaymentAction(
                        payment.paymentId,
                        session.id,
                      );
                      if (result.success) {
                        setPayment(null);
                        setSelectedFile(null);
                        setJustSubmitted(false);
                      }
                      return result;
                    })
                  }
                >
                  {tUx("cancel")}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {allowDevBypass ? (
            <Button
              className="rounded-xl"
              disabled={pending}
              onClick={() => run(() => confirmUnlockDevBypassAction(session.id))}
            >
              {t("provider.devConfirm")}
            </Button>
          ) : !paymentsEnabled ? (
            <p className="text-sm text-muted-foreground">{t("provider.awaitAdminOrSprint6")}</p>
          ) : null}
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={pending}
            onClick={() => run(() => declineUnlockAction(session.id))}
          >
            {t("provider.decline")}
          </Button>
        </div>
      ) : null}

      {error ? (
        <PaymentAlert variant="error" title={tUx("errorTitle")} body={error} />
      ) : null}
    </div>
  );
}
