import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isSmartMatchingEngineEnabled } from "@/lib/config/feature-flags";
import { getAdminMatchingDashboard } from "@/lib/matching-engine/admin";
import { AdminMatchingCenterPanel } from "@/components/admin/admin-matching-center-panel";
import { Link } from "@/lib/i18n/routing";

export default async function AdminMatchingPage() {
  if (!isSmartMatchingEngineEnabled()) {
    redirect("/admin");
  }

  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) {
    redirect("/admin");
  }

  const t = await getTranslations("admin.matching");
  const data = await getAdminMatchingDashboard();

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
          <Link href="/admin/reputation" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.reputation")}
          </Link>
          <Link href="/admin/fraud" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.fraud")}
          </Link>
          <Link href="/admin/ai-ops" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.aiOps")}
          </Link>
        </div>
      </header>

      <AdminMatchingCenterPanel data={data} />
    </div>
  );
}
