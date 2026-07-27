import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { isAiDynamicPricingEnabled } from "@/lib/config/feature-flags";
import { getFairMarketEstimate } from "@/lib/ai/pricing";
import { CustomerFairMarketEstimate } from "@/components/pricing/customer-fair-market-estimate";

export default async function AccountPricingPage() {
  if (!isAiDynamicPricingEnabled()) {
    redirect("/account");
  }

  await requireAuthUser();
  const t = await getTranslations("pricing.customer");
  const estimate = await getFairMarketEstimate({
    categoryKey: "general",
    regionKey: "all",
  });

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8 animate-fade-in">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {estimate ? (
        <CustomerFairMarketEstimate recommendation={estimate} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      )}
    </div>
  );
}
