"use client";

import { useTransition, useState } from "react";
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<UnlockFeePaymentView | null>(initialPayment);
  const [uploading, setUploading] = useState(false);

  const run = (fn: () => Promise<{ success: boolean; error?: string; payment?: UnlockFeePaymentView }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      if (result.payment) setPayment(result.payment);
      // Cancel returns success without payment — refresh will clear
      router.refresh();
    });
  };

  const open = session.status === "opened" || session.status === "payment_pending";

  async function onReceiptSelected(file: File | null) {
    if (!file || !payment) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadPaymentReceiptDirect({
        paymentId: payment.paymentId,
        file,
        prepare: preparePaymentReceiptUploadAction,
        confirm: confirmPaymentReceiptUploadAction,
      });
      if (!uploaded.success) {
        setError(uploaded.error ?? "receipt_failed");
        return;
      }
      setPayment({
        ...payment,
        status: "pending_review",
        hasReceipt: true,
      });
      router.refresh();
    } catch {
      setError("receipt_failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border p-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("provider.title")}</h1>
        <p className="text-sm text-muted-foreground">{requestTitle}</p>
        <p className="text-sm">
          {t("provider.fee", {
            amount: session.feeAmount,
            currency: session.feeCurrency,
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("provider.sla", { deadline: new Date(session.slaDeadline).toLocaleString() })}
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t(`status.${session.status}`)}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">{t("provider.noContactUntilPay")}</p>

      {paymentsEnabled && open ? (
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
          {!payment ? (
            <Button
              className="rounded-xl"
              disabled={pending}
              onClick={() => run(() => startUnlockFeePaymentAction(session.id))}
            >
              {t("provider.startPayment")}
            </Button>
          ) : (
            <>
              <p className="font-medium">{t("provider.paymentInstructions")}</p>
              <p>
                {t("provider.payAmount", {
                  amount: payment.amount,
                  currency: payment.currency,
                })}
              </p>
              <p className="font-mono text-xs">{payment.reference}</p>
              {payment.receiver ? (
                <p className="text-muted-foreground">
                  {t("provider.receiver")}: {payment.receiver}
                </p>
              ) : null}
              {payment.account ? (
                <p className="text-muted-foreground">
                  {t("provider.account")}: {payment.account}
                </p>
              ) : null}
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {payment.status}
              </p>
              {payment.status === "pending" && !payment.hasReceipt ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    {t("provider.uploadReceipt")}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="mt-1 block w-full text-sm"
                      disabled={uploading || pending}
                      onChange={(e) => onReceiptSelected(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const result = await cancelUnlockFeePaymentAction(
                          payment.paymentId,
                          session.id,
                        );
                        if (result.success) setPayment(null);
                        return result;
                      })
                    }
                  >
                    {t("provider.cancelPayment")}
                  </Button>
                </div>
              ) : null}
              {payment.status === "pending_review" ? (
                <p className="text-sm text-muted-foreground">{t("provider.awaitingReview")}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-2 sm:flex-row">
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
            className="rounded-xl"
            disabled={pending}
            onClick={() => run(() => declineUnlockAction(session.id))}
          >
            {t("provider.decline")}
          </Button>
        </div>
      ) : null}

      {session.status === "succeeded" ? (
        <p className="text-sm font-medium">{t("provider.succeeded")}</p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${error}` as "errors.failed")}
        </p>
      ) : null}
    </div>
  );
}
