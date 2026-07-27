import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isQualityCasesEnabled } from "@/lib/config/feature-flags";
import { listQualityCasesForProvider } from "@/lib/quality/queries";
import { getProviderQualityInsights } from "@/lib/quality/metrics";
import { ProviderQualityInsightsPanel } from "@/components/quality/provider-quality-insights-panel";
import { QualityCaseCreateForm } from "@/components/quality/quality-case-create-form";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";

export default async function BusinessQualityPage() {
  if (!isQualityCasesEnabled()) {
    redirect("/business");
  }

  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  const t = await getTranslations("quality.provider");

  if (!provider) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ProviderCreateFormLoader />
      </div>
    );
  }

  const [cases, insights] = await Promise.all([
    listQualityCasesForProvider(provider.id),
    getProviderQualityInsights(provider.id),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ProviderQualityInsightsPanel insights={insights} cases={cases} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("openCase")}</h2>
        <QualityCaseCreateForm role="provider" providerId={provider.id} />
      </section>
    </div>
  );
}
