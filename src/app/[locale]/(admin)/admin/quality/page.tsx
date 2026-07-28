import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isQualityCasesEnabled } from "@/lib/config/feature-flags";
import { getAdminQualityDashboard } from "@/lib/quality/queries";
import { AdminQualityCasesPanel } from "@/components/admin/admin-quality-cases-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminQualityPage() {
  if (!isQualityCasesEnabled()) {
    redirect("/admin/issues");
  }

  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) {
    redirect("/admin");
  }

  const t = await getTranslations("admin.quality");
  const data = await getAdminQualityDashboard();

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/issues" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.issues")}
          </Link>
          <Link href="/admin/refunds" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.refunds")}
          </Link>
        </div>
      </header>

      <AdminQualityCasesPanel data={data} />
    </div>
  );
}
