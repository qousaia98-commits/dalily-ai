"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listMyDisputesAction,
  listMyRefundsAction,
  requestRefundAction,
} from "@/actions/refund.actions";
import { downloadFinancialDocumentAction } from "@/actions/financial-documents.actions";
import type { PaymentDispute, RefundRequest } from "@/lib/refunds";
import type { PaymentRecord } from "@/lib/payment/canonical-types";
import { formatDateTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

export function ProviderRefundsPanel({
  initialRefunds,
  initialDisputes,
  paidPayments,
}: {
  initialRefunds: RefundRequest[];
  initialDisputes: PaymentDispute[];
  paidPayments: PaymentRecord[];
}) {
  const t = useTranslations("refunds");
  const locale = useLocale();
  const [refunds, setRefunds] = useState(initialRefunds);
  const [disputes, setDisputes] = useState(initialDisputes);
  const [paymentId, setPaymentId] = useState(paidPayments[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      const [r, d] = await Promise.all([
        listMyRefundsAction(),
        listMyDisputesAction(),
      ]);
      if (r.ok) setRefunds(r.refunds);
      if (d.ok) setDisputes(d.disputes);
    });
  }

  function submitRequest() {
    startTransition(async () => {
      if (!paymentId || reason.trim().length < 3) {
        toast.error(t("requestInvalid"));
        return;
      }
      const parsedAmount =
        amount.trim() === "" ? null : Number(amount.replace(",", "."));
      if (parsedAmount != null && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
        toast.error(t("requestInvalid"));
        return;
      }
      const result = await requestRefundAction({
        paymentId,
        amount: parsedAmount,
        reason: reason.trim(),
      });
      if (!result.ok) {
        const errorMap: Record<string, string> = {
          feature_disabled: t("errors.feature_disabled"),
          login_required: t("errors.login_required"),
          forbidden: t("errors.forbidden"),
          invalid_input: t("errors.invalid_input"),
          payment_not_found: t("errors.payment_not_found"),
          payment_not_paid: t("errors.payment_not_paid"),
          nothing_to_refund: t("errors.nothing_to_refund"),
          amount_exceeds_remaining: t("errors.amount_exceeds_remaining"),
          refund_already_open: t("errors.refund_already_open"),
          create_failed: t("errors.create_failed"),
        };
        toast.error(errorMap[result.error] ?? t("errors.generic"));
        return;
      }
      toast.success(t("requestSuccess"));
      setReason("");
      setAmount("");
      reload();
    });
  }

  function downloadCreditNote(documentId: string) {
    startTransition(async () => {
      const result = await downloadFinancialDocumentAction(documentId);
      if (!result.ok) {
        toast.error(t("downloadError"));
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold">{t("requestTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("requestHint")}</p>
        <select
          className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
        >
          {paidPayments.length === 0 ? (
            <option value="">{t("noPaidPayments")}</option>
          ) : (
            paidPayments.map((p) => (
              <option key={p.id} value={p.id}>
                {p.amount} {p.currency} · {p.reference}
                {p.refundedAmount > 0
                  ? ` (${t("alreadyRefunded")}: ${p.refundedAmount})`
                  : ""}
              </option>
            ))
          )}
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("amountPlaceholder")}
          className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
        />
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          rows={3}
          className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        />
        <Button
          type="button"
          onClick={submitRequest}
          disabled={pending || !paymentId}
        >
          {t("submitRequest")}
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("historyTitle")}</h3>
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {refunds.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "rounded-2xl border border-border bg-card p-4",
                  pending && "opacity-70",
                )}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {r.refundAmount} {r.currency} · {t(`type.${r.refundType}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt, locale)} · {t(`status.${r.status}`)}
                    </p>
                    <p className="mt-1 text-sm">{r.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("remaining")}: {r.remainingAmount} {r.currency}
                    </p>
                  </div>
                  {r.financialDocumentId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadCreditNote(r.financialDocumentId!)}
                    >
                      {t("downloadCreditNote")}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("disputesTitle")}</h3>
        {disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyDisputes")}</p>
        ) : (
          <ul className="space-y-3">
            {disputes.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <p className="font-semibold">
                  {d.amount ?? "—"} {d.currency} ·{" "}
                  {t(`disputeStatus.${d.status}`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(d.openedAt, locale)}
                  {d.reason ? ` · ${d.reason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
