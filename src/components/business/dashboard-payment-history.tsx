"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export type DashboardPaymentHistoryItem = {
  id: string;
  planLabel: string;
  paymentStatus: string;
  paymentReference: string;
  amount: number;
  currency: string;
  submittedAt: string | null;
  approvedAt: string | null;
  adminNote: string | null;
  createdAt: string;
};

export function DashboardPaymentHistory({
  currentPlanLabel,
  currentStatus,
  payments,
}: {
  currentPlanLabel: string;
  currentStatus: string;
  payments: DashboardPaymentHistoryItem[];
}) {
  const t = useTranslations("business.dashboard.paymentHistory");
  const locale = useLocale();

  return (
    <section className="w-full rounded-2xl border border-[#E8ECF2] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-[var(--dalily-navy)]">{t("title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[var(--dalily-navy)] text-white hover:bg-[var(--dalily-navy)]">
            {currentPlanLabel}
          </Badge>
          <Badge variant="secondary">{currentStatus}</Badge>
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="rounded-2xl border border-[#E8ECF2] px-4 py-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[var(--dalily-navy)]">{payment.planLabel}</p>
                <Badge variant="outline">{t(`status.${payment.paymentStatus}`)}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Meta label={t("reference")} value={payment.paymentReference} mono />
                <Meta
                  label={t("amount")}
                  value={`${payment.amount} ${payment.currency}`}
                />
                <Meta
                  label={t("submittedAt")}
                  value={
                    payment.submittedAt
                      ? new Date(payment.submittedAt).toLocaleString(locale)
                      : new Date(payment.createdAt).toLocaleString(locale)
                  }
                />
                <Meta
                  label={t("approvedAt")}
                  value={
                    payment.approvedAt
                      ? new Date(payment.approvedAt).toLocaleString(locale)
                      : "—"
                  }
                />
              </div>
              {payment.paymentStatus === "rejected" && payment.adminNote ? (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {t("rejectedReason")}: {payment.adminNote}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={
          mono
            ? "mt-0.5 break-all font-mono text-xs font-semibold text-[var(--dalily-navy)]"
            : "mt-0.5 font-medium text-[var(--dalily-navy)]"
        }
      >
        {value}
      </p>
    </div>
  );
}
