import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { isForecastEngineEnabled } from "@/lib/config/feature-flags";
import { getCustomerDemandHint } from "@/domains/forecast";
import { CustomerDemandHintCard } from "@/components/forecast/customer-demand-hint-card";

export default async function AccountForecastPage() {
  if (!isForecastEngineEnabled()) {
    redirect("/account");
  }

  await requireAuthUser();
  const t = await getTranslations("forecast.customer");
  const hint = await getCustomerDemandHint({ categoryKey: "general" });

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8 animate-fade-in">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {hint ? (
        <CustomerDemandHintCard hint={hint} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      )}
    </div>
  );
}
