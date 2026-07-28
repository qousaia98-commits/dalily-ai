import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getRefundStats, listDisputes, listRefunds } from "@/lib/refunds";
import { AdminRefundsPanel } from "@/components/admin/admin-refunds-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminRefundsPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.refunds");

  const [refunds, stats, disputes] = await Promise.all([
    listRefunds({ limit: 200 }),
    getRefundStats(),
    listDisputes({ limit: 100 }),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        <div className="mt-2 flex flex-wrap gap-4">
          <Link
            href="/admin/payments"
            className="text-sm text-[var(--dalily-gold)] hover:underline"
          >
            {t("backToPayments")}
          </Link>
          <Link
            href="/admin/documents"
            className="text-sm text-[var(--dalily-gold)] hover:underline"
          >
            {t("toDocuments")}
          </Link>
        </div>
      </div>

      <AdminRefundsPanel
        initialRefunds={refunds}
        initialStats={stats}
        initialDisputes={disputes}
      />
    </div>
  );
}
