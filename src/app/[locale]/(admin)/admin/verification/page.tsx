import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { listPendingVerificationsForAdmin } from "@/lib/verification/queries";
import { AdminVerificationList } from "@/components/admin/admin-verification-list";

export default async function AdminVerificationPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.verification");
  const items = await listPendingVerificationsForAdmin();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AdminVerificationList items={items} />
    </div>
  );
}
