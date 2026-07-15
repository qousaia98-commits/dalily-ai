import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPaymentDetailForAdmin } from "@/lib/subscription/repository";
import { AdminPaymentDetailPanel } from "@/components/admin/admin-payment-detail-panel";

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("admin.payments");
  const { id } = await params;
  const payment = await getPaymentDetailForAdmin(id);

  if (!payment) notFound();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-bold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-3xl">
          {t("detail.pageTitle")}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">{payment.paymentReference}</p>
      </div>

      <AdminPaymentDetailPanel payment={payment} />
    </div>
  );
}
