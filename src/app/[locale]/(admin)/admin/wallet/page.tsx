import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireFinanceUser } from "@/lib/auth/session";
import { isPaymentsV2Enabled } from "@/lib/config/feature-flags";
import {
  getEnterprisePaymentOverview,
  listAdminEscrows,
  listAdminPayouts,
  listAdminFeeRules,
  listAdminMarketplaceDisputes,
} from "@/domains/payment/admin/overview";
import { AdminEnterprisePaymentPanel } from "@/components/admin/admin-enterprise-payment-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminWalletPage() {
  await requireFinanceUser();
  if (!isPaymentsV2Enabled()) {
    redirect("/admin/payments");
  }

  const t = await getTranslations("admin.enterprisePayments");
  const [overview, escrows, payouts, feeRules, disputes] = await Promise.all([
    getEnterprisePaymentOverview(),
    listAdminEscrows(100),
    listAdminPayouts(100),
    listAdminFeeRules(),
    listAdminMarketplaceDisputes(100),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          <Link
            href="/admin/payments"
            className="text-sm text-[var(--dalily-gold)] hover:underline"
          >
            {t("toPayments")}
          </Link>
          <Link
            href="/admin/refunds"
            className="text-sm text-[var(--dalily-gold)] hover:underline"
          >
            {t("toRefunds")}
          </Link>
          <Link
            href="/admin/finance"
            className="text-sm text-[var(--dalily-gold)] hover:underline"
          >
            {t("toFinance")}
          </Link>
        </div>
      </div>

      <AdminEnterprisePaymentPanel
        overview={overview}
        escrows={escrows as never}
        payouts={payouts as never}
        feeRules={feeRules as never}
        disputes={disputes as never}
      />
    </div>
  );
}
