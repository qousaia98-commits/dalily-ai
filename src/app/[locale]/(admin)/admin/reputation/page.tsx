import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { isAiReputationEngineEnabled } from "@/lib/config/feature-flags";
import { getAdminReputationDashboard } from "@/lib/reputation/admin";
import { AdminReputationDashboardPanel } from "@/components/admin/admin-reputation-dashboard";
import { Link } from "@/lib/i18n/routing";

export default async function AdminReputationPage() {
  if (!isAiReputationEngineEnabled()) {
    redirect("/admin/reviews");
  }

  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) {
    redirect("/admin");
  }

  const t = await getTranslations("admin.reputation");
  const data = await getAdminReputationDashboard();

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/reviews" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.reviews")}
          </Link>
          <Link href="/admin/providers" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.providers")}
          </Link>
        </div>
      </header>

      <AdminReputationDashboardPanel data={data} />
    </div>
  );
}
