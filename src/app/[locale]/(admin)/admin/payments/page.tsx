import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { countPaymentsByStatus, listPaymentsForAdmin } from "@/lib/subscription/repository";
import { getPaymentAdminStats } from "@/lib/payment/admin-stats";
import { AdminPaymentsPanel } from "@/components/admin/admin-payments-panel";
import { AdminPaymentStatsCards } from "@/components/admin/admin-payment-stats-cards";
import { Link } from "@/lib/i18n/navigation";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const t = await getTranslations("admin.payments");
  const params = await searchParams;

  const [{ items }, counts, stats] = await Promise.all([
    listPaymentsForAdmin({ status: "all", pageSize: 200 }),
    countPaymentsByStatus(),
    getPaymentAdminStats(),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-bold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
        <Link
          href="/admin/webhooks"
          className="mt-2 me-4 inline-block text-sm font-medium text-[var(--dalily-gold)] hover:underline"
        >
          Stripe webhooks →
        </Link>
        <Link
          href="/admin/documents"
          className="mt-2 me-4 inline-block text-sm font-medium text-[var(--dalily-gold)] hover:underline"
        >
          Invoices & receipts →
        </Link>
        <Link
          href="/admin/refunds"
          className="mt-2 me-4 inline-block text-sm font-medium text-[var(--dalily-gold)] hover:underline"
        >
          Refunds & disputes →
        </Link>
        <Link
          href="/admin/finance"
          className="mt-2 inline-block text-sm font-medium text-[var(--dalily-gold)] hover:underline"
        >
          Finance analytics →
        </Link>
      </div>

      <AdminPaymentStatsCards stats={stats} />

      <AdminPaymentsPanel payments={items} counts={counts} initialTab={params.tab} />
    </div>
  );
}
