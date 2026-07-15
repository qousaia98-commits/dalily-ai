"use client";

import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, FileText } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { getLocalizedField } from "@/types/provider.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PaymentRow = {
  id: string;
  providerName: { ar: string; en: string };
  ownerName: string | null;
  planSlug: string;
  amount: number;
  currency: string;
  paymentReference: string;
  receiptPath: string | null;
  createdAt: string;
  paymentStatus: string;
};

export function AdminPaymentsTable({ payments }: { payments: PaymentRow[] }) {
  const t = useTranslations("admin.payments");
  const locale = useLocale();

  if (payments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[900px] text-start text-sm">
        <thead className="border-b bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">{t("columns.company")}</th>
            <th className="px-4 py-3 font-semibold">{t("columns.owner")}</th>
            <th className="px-4 py-3 font-semibold">{t("columns.plan")}</th>
            <th className="px-4 py-3 font-semibold">{t("columns.amount")}</th>
            <th className="px-4 py-3 font-semibold">{t("columns.reference")}</th>
            <th className="px-4 py-3 font-semibold">{t("columns.receipt")}</th>
            <th className="px-4 py-3 font-semibold">{t("columns.requestedAt")}</th>
            <th className="px-4 py-3 font-semibold">{t("columns.status")}</th>
            <th className="px-4 py-3 text-end font-semibold">{t("columns.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="max-w-[140px] truncate px-4 py-3.5 font-medium">
                {getLocalizedField(payment.providerName, locale)}
              </td>
              <td className="max-w-[120px] truncate px-4 py-3.5 text-muted-foreground">
                {payment.ownerName ?? "—"}
              </td>
              <td className="px-4 py-3.5">
                <Badge variant="outline">{t(`plans.${payment.planSlug}`)}</Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3.5 font-semibold">
                {payment.amount} {payment.currency}
              </td>
              <td className="px-4 py-3.5">
                <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                  {payment.paymentReference}
                </code>
              </td>
              <td className="px-4 py-3.5">
                {payment.receiptPath ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <FileText className="size-3.5" />
                    {t("hasReceipt")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t("noReceipt")}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">
                {new Date(payment.createdAt).toLocaleString(locale)}
              </td>
              <td className="px-4 py-3.5">
                <Badge variant="secondary">{t(`status.${payment.paymentStatus}`)}</Badge>
              </td>
              <td className="px-4 py-3.5 text-end">
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link href={`/admin/payments/${payment.id}`}>
                    {t("review")}
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
