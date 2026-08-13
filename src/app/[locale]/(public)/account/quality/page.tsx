import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { isQualityCasesEnabled } from "@/lib/config/feature-flags";
import { listQualityCasesForCustomer } from "@/lib/quality/queries";
import { CustomerQualityCasesPanel } from "@/components/quality/customer-quality-cases-panel";

export default async function AccountQualityPage() {
  if (!isQualityCasesEnabled()) {
    redirect("/account");
  }

  const authUser = await requireAuthUser();
  const t = await getTranslations("quality.customer");
  const cases = await listQualityCasesForCustomer(authUser.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <CustomerQualityCasesPanel cases={cases} />
    </div>
  );
}
