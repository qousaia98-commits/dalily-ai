"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getPaymentReceiptDownloadUrlAction,
  listMyPaymentHistoryAction,
} from "@/actions/payment-history.actions";
import type { PaymentRecord } from "@/lib/payment/canonical-types";
import { formatDateTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

function purposeLabel(
  purpose: string,
  t: ReturnType<typeof useTranslations<"paymentHistory">>,
): string {
  if (purpose === "unlock_fee" || purpose === "lead_unlock") {
    return t("purpose.leadUnlock");
  }
  if (purpose === "business_subscription") return t("purpose.business");
  if (purpose === "subscription") return t("purpose.subscription");
  return purpose;
}

export function PaymentHistoryPanel({
  initialPayments,
}: {
  initialPayments: PaymentRecord[];
}) {
  const t = useTranslations("paymentHistory");
  const locale = useLocale();
  const [payments, setPayments] = useState(initialPayments);
  const [purpose, setPurpose] = useState<"all" | "lead_unlock" | "business_subscription" | "subscription">("all");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "pending_review" | "failed" | "rejected">("all");
  const [month, setMonth] = useState<"all" | "current" | "previous">("all");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filteredHint = useMemo(
    () => t("resultCount", { count: payments.length }),
    [payments.length, t],
  );

  function reload(next?: {
    purpose?: typeof purpose;
    status?: typeof status;
    month?: typeof month;
    query?: string;
  }) {
    const p = next?.purpose ?? purpose;
    const s = next?.status ?? status;
    const m = next?.month ?? month;
    const q = next?.query ?? query;
    startTransition(async () => {
      const result = await listMyPaymentHistoryAction({
        purpose: p,
        status: s,
        month: m,
        query: q,
      });
      if (!result.ok) {
        toast.error(t("loadError"));
        return;
      }
      setPayments(result.payments);
    });
  }

  function downloadReceipt(paymentId: string) {
    startTransition(async () => {
      const result = await getPaymentReceiptDownloadUrlAction(paymentId);
      if (!result.ok) {
        toast.error(t("downloadError"));
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", t("filters.all")],
            ["current", t("filters.currentMonth")],
            ["previous", t("filters.previousMonth")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMonth(key);
              reload({ month: key });
            }}
            className={cn(
              "rounded-2xl border px-3 py-2 text-sm font-semibold transition",
              month === key
                ? "border-[var(--dalily-navy)] bg-[var(--dalily-navy)] text-white"
                : "border-border bg-card hover:bg-muted/40",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          className="h-11 rounded-2xl border border-border bg-card px-3 text-sm"
          value={purpose}
          onChange={(e) => {
            const v = e.target.value as typeof purpose;
            setPurpose(v);
            reload({ purpose: v });
          }}
          aria-label={t("filters.purpose")}
        >
          <option value="all">{t("filters.purposeAll")}</option>
          <option value="business_subscription">{t("purpose.business")}</option>
          <option value="lead_unlock">{t("purpose.leadUnlock")}</option>
          <option value="subscription">{t("purpose.subscription")}</option>
        </select>
        <select
          className="h-11 rounded-2xl border border-border bg-card px-3 text-sm"
          value={status}
          onChange={(e) => {
            const v = e.target.value as typeof status;
            setStatus(v);
            reload({ status: v });
          }}
          aria-label={t("filters.status")}
        >
          <option value="all">{t("filters.statusAll")}</option>
          <option value="paid">{t("status.paid")}</option>
          <option value="pending">{t("status.pending")}</option>
          <option value="pending_review">{t("status.pending_review")}</option>
          <option value="failed">{t("status.failed")}</option>
          <option value="rejected">{t("status.rejected")}</option>
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") reload({ query });
            }}
            placeholder={t("searchPlaceholder")}
            className="h-11 w-full rounded-2xl border border-border bg-card pe-3 ps-10 text-sm outline-none ring-[var(--dalily-gold)]/40 focus:ring-2"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filteredHint}</p>

      {payments.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {payments.map((p) => (
            <li
              key={p.id}
              className={cn(
                "rounded-2xl border border-border bg-card p-4",
                pending && "opacity-70",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{purposeLabel(p.purpose, t)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(p.createdAt, locale)} · {p.reference}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold tabular-nums">
                    {p.amount} {p.currency}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`status.${p.status}` as "status.paid")}
                  </p>
                  {p.refundedAmount > 0 || p.refundStatus === "pending" ? (
                    <p className="text-xs text-[var(--dalily-gold)]">
                      {p.refundStatus === "pending"
                        ? t("refund.pending")
                        : t("refund.refunded", {
                            amount: p.refundedAmount,
                            currency: p.currency,
                          })}
                    </p>
                  ) : null}
                </div>
              </div>
              {p.hasReceipt ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={pending}
                  onClick={() => downloadReceipt(p.id)}
                >
                  <Download className="me-1.5 size-3.5" />
                  {t("downloadReceipt")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
