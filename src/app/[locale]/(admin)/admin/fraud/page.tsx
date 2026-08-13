import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isFraudDetectionEnabled } from "@/lib/config/feature-flags";
import { getAdminFraudDashboard } from "@/lib/fraud/queries";
import { AdminFraudInvestigationPanel } from "@/components/admin/admin-fraud-investigation-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminFraudPage() {
  if (!isFraudDetectionEnabled()) {
    redirect("/admin");
  }

  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) {
    redirect("/admin");
  }

  const t = await getTranslations("admin.fraud");
  const data = await getAdminFraudDashboard();

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("privacyNotice")}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/quality" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.quality")}
          </Link>
          <Link href="/admin/reviews" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.reviews")}
          </Link>
        </div>
      </header>

      <AdminFraudInvestigationPanel data={data} />
    </div>
  );
}
