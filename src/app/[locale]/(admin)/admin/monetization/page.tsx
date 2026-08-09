import { requireAdminUser } from "@/lib/auth/session";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import { getBillingSettings } from "@/lib/monetization";
import { AdminMonetizationSettingsForm } from "@/components/admin/admin-monetization-settings-form";
import { AdminMarkSubscriptionPaidForm } from "@/components/admin/admin-mark-subscription-paid-form";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export default async function AdminMonetizationPage() {
  await requireAdminUser();
  if (!isProviderMonetizationEnabled()) redirect("/admin/settings");

  const t = await getTranslations("monetization.admin");
  const settings = await getBillingSettings();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AdminMonetizationSettingsForm initial={settings} />
      <AdminMarkSubscriptionPaidForm />
    </main>
  );
}
