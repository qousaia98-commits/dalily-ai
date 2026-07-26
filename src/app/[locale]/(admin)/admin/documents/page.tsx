import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import {
  getCompanyBillingSettings,
  getDocumentStats,
  listFinancialDocuments,
  listMissingDocumentPayments,
} from "@/lib/financial-documents";
import { AdminFinancialDocumentsPanel } from "@/components/admin/admin-financial-documents-panel";
import { CompanyBillingSettingsForm } from "@/components/admin/company-billing-settings-form";
import { Link } from "@/lib/i18n/routing";

export default async function AdminDocumentsPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.financialDocuments");

  const [documents, stats, missing, settings] = await Promise.all([
    listFinancialDocuments({ limit: 200 }),
    getDocumentStats(),
    listMissingDocumentPayments(40),
    getCompanyBillingSettings(),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        <Link
          href="/admin/payments"
          className="mt-2 inline-block text-sm text-[var(--dalily-gold)] hover:underline"
        >
          {t("backToPayments")}
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("companySettings")}</h2>
        <CompanyBillingSettingsForm initial={settings} />
      </section>

      <AdminFinancialDocumentsPanel
        initialDocuments={documents}
        initialStats={stats}
        initialMissing={missing}
      />
    </div>
  );
}
