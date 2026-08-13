import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiBusinessAssistantEnabled } from "@/lib/config/feature-flags";
import { getAdminBusinessDashboard } from "@/lib/business-assistant/admin";
import { AdminBusinessAssistantPanel } from "@/components/admin/admin-business-assistant-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminBusinessAssistantPage() {
  if (!isAiBusinessAssistantEnabled()) redirect("/admin");
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) redirect("/admin");

  const t = await getTranslations("admin.businessAssistant");
  const data = await getAdminBusinessDashboard();

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/scheduling" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.scheduling")}
          </Link>
          <Link href="/admin/forecast" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.forecast")}
          </Link>
        </div>
      </header>
      <AdminBusinessAssistantPanel data={data} />
    </div>
  );
}
