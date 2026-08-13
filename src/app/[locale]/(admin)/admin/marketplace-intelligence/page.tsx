import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiMarketplaceIntelligenceEnabled } from "@/lib/config/feature-flags";
import { getAdminMarketplaceCenter } from "@/lib/marketplace-intelligence/admin";
import { AdminMarketplaceIntelligencePanel } from "@/components/admin/admin-marketplace-intelligence-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminMarketplaceIntelligencePage() {
  if (!isAiMarketplaceIntelligenceEnabled()) redirect("/admin");
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) redirect("/admin");

  const t = await getTranslations("admin.marketplaceIntelligence");
  const data = await getAdminMarketplaceCenter();

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/business-assistant" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.businessAssistant")}
          </Link>
          <Link href="/admin/forecast" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.forecast")}
          </Link>
          <Link href="/admin/pricing" className="text-[var(--dalily-gold)] hover:underline">
            {t("links.pricing")}
          </Link>
        </div>
      </header>
      <AdminMarketplaceIntelligencePanel data={data} />
    </div>
  );
}
