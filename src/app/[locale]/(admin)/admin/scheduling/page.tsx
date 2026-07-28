import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiSchedulingEnabled } from "@/lib/config/feature-flags";
import { getAdminScheduleDashboard } from "@/lib/scheduling-engine/admin";
import { AdminSchedulingCenterPanel } from "@/components/admin/admin-scheduling-center-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminSchedulingPage() {
  if (!isAiSchedulingEnabled()) redirect("/admin");
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) redirect("/admin");

  const t = await getTranslations("admin.scheduling");
  const data = await getAdminScheduleDashboard();

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
          <Link href="/admin/forecast" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.forecast")}
          </Link>
          <Link href="/admin/matching" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.matching")}
          </Link>
          <Link href="/admin/pricing" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.pricing")}
          </Link>
        </div>
      </header>
      <AdminSchedulingCenterPanel data={data} />
    </div>
  );
}
