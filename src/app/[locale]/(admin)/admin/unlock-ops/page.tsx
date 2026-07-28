import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { isAdminMigrationV2Enabled } from "@/lib/config/feature-flags";
import { getUnlockOpsOverview } from "@/domains/admin/unlock-ops";
import { UnlockOpsPanel } from "@/components/admin/unlock-ops-panel";
import { Link } from "@/lib/i18n/navigation";

export default async function AdminUnlockOpsPage() {
  if (!isAdminMigrationV2Enabled()) redirect("/admin/payments");

  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) redirect("/admin");

  const t = await getTranslations("admin.unlockOps");
  const overview = await getUnlockOpsOverview();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          <Link href="/admin/payments" className="underline">
            {t("allPayments")}
          </Link>
        </p>
      </div>
      <UnlockOpsPanel overview={overview} />
    </div>
  );
}
