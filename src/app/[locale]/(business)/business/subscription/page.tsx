import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { BusinessSubscriptionPanel } from "@/components/business/business-subscription-panel";
import { ProviderCreateForm } from "@/components/business/provider-create-form";

export default async function BusinessSubscriptionPage() {
  const t = await getTranslations("business.subscription");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ProviderCreateForm />
      </div>
    );
  }

  const { subscription, plans, payments } = await getSubscriptionPageData(authUser.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <BusinessSubscriptionPanel
        currentPlanSlug={subscription?.planSlug ?? "free"}
        status={subscription?.status ?? "active"}
        expiresAt={subscription?.expiresAt ?? null}
        plans={plans}
        payments={payments}
      />
    </div>
  );
}
