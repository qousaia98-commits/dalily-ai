import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isAiPlatformEnabled } from "@/lib/config/feature-flags";
import { getAiAdminCenterOverview } from "@/domains/ai";
import { AdminAiPlatformPanel } from "@/components/admin/admin-ai-platform-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminAiPlatformPage() {
  await requireAdminUser();
  if (!isAiPlatformEnabled()) {
    redirect("/admin");
  }

  const t = await getTranslations("admin.aiPlatform");
  const overview = await getAiAdminCenterOverview();

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
            href="/admin/ai-ops"
            className="text-sm text-[var(--dalily-gold)] hover:underline"
          >
            {t("toOps")}
          </Link>
          <Link
            href="/admin/fraud"
            className="text-sm text-[var(--dalily-gold)] hover:underline"
          >
            {t("toFraud")}
          </Link>
        </div>
      </div>
      <AdminAiPlatformPanel overview={overview} />
    </div>
  );
}
