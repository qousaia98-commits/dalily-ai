"use client";

import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaymentNotice = {
  status: "pending_review" | "paid" | "rejected";
  planLabel: string;
  amount: number;
  currency: string;
  reference: string;
  submittedAt: string | null;
  approvedAt: string | null;
  adminNote: string | null;
};

export function DashboardPaymentStatusCard({ payment }: { payment: PaymentNotice }) {
  const t = useTranslations("business.dashboard.paymentStatus");
  const locale = useLocale();

  if (payment.status === "pending_review") {
    return (
      <section className="w-full overflow-hidden rounded-2xl border border-[var(--dalily-gold)]/40 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)] p-5 shadow-[0_12px_32px_-18px_rgba(11,21,38,0.2)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Clock3 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-700">{t("reviewTitle")}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#5C6478]">{t("reviewBody")}</p>
            <PaymentMeta payment={payment} locale={locale} />
            <Button asChild variant="outline" className="mt-4 h-11 w-full rounded-2xl sm:w-auto">
              <Link href="/business/subscription">{t("viewPayment")}</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (payment.status === "paid") {
    return (
      <section className="w-full overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-700">{t("activatedTitle")}</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-900/70">{t("activatedBody")}</p>
            <PaymentMeta payment={payment} locale={locale} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
          <XCircle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-rose-700">{t("rejectedTitle")}</p>
          <p className="mt-2 text-sm leading-relaxed text-rose-900/70">{t("rejectedBody")}</p>
          {payment.adminNote ? (
            <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-sm text-[var(--dalily-navy)]">
              {t("adminNote")}: {payment.adminNote}
            </p>
          ) : null}
          <PaymentMeta payment={payment} locale={locale} />
          <Button asChild className="mt-4 h-11 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)] sm:w-auto">
            <Link href="/business/subscription">{t("tryAgain")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function PaymentMeta({
  payment,
  locale,
}: {
  payment: PaymentNotice;
  locale: string;
}) {
  const t = useTranslations("business.dashboard.paymentStatus");
  const rows = [
    { label: t("plan"), value: payment.planLabel },
    { label: t("amount"), value: `${payment.amount} ${payment.currency}` },
    { label: t("reference"), value: payment.reference, mono: true },
    {
      label: t("submittedAt"),
      value: payment.submittedAt
        ? new Date(payment.submittedAt).toLocaleString(locale)
        : "—",
    },
    { label: t("status"), value: t(`statusLabels.${payment.status}`) },
  ];

  return (
    <dl className="mt-4 grid gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-xl bg-white/70 px-3 py-2">
          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {row.label}
          </dt>
          <dd
            className={cn(
              "mt-0.5 truncate text-sm font-semibold text-[var(--dalily-navy)]",
              row.mono && "font-mono text-xs break-all whitespace-normal",
            )}
            title={row.value}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
