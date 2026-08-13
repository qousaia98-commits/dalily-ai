import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiOpsEnabled } from "@/lib/config/feature-flags";
import { getAiOpsDashboard } from "@/lib/ai-ops/queries";
import { AdminAiOpsDashboardPanel } from "@/components/admin/admin-ai-ops-dashboard";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminAiOpsPage() {
  if (!isAiOpsEnabled()) {
    redirect("/admin");
  }

  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) {
    redirect("/admin");
  }

  const t = await getTranslations("admin.aiOps");
  const data = await getAiOpsDashboard();

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/fraud" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.fraud")}
          </Link>
          <Link href="/admin/quality" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.quality")}
          </Link>
          <Link href="/admin/reputation" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.reputation")}
          </Link>
          <Link href="/admin/ai-platform" className="text-[var(--dalily-gold)] hover:underline">
            AI Platform
          </Link>
        </div>
      </header>

      <AdminAiOpsDashboardPanel data={data} />
    </div>
  );
}
