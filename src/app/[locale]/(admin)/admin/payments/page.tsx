import { getTranslations } from "next-intl/server";
import { countPaymentsByStatus, listPaymentsForAdmin } from "@/lib/subscription/repository";
import { AdminPaymentsPanel } from "@/components/admin/admin-payments-panel";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const t = await getTranslations("admin.payments");
  const params = await searchParams;

  const [{ items }, counts] = await Promise.all([
    listPaymentsForAdmin({ status: "all", pageSize: 200 }),
    countPaymentsByStatus(),
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
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AdminPaymentsPanel payments={items} counts={counts} initialTab={params.tab} />
    </div>
  );
}
