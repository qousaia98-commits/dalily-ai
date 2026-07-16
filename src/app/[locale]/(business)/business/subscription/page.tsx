import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { isProviderSubscriptionUnlocked } from "@/lib/providers/approval-readiness";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { BusinessSubscriptionPanel } from "@/components/business/business-subscription-panel";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { SubscriptionLockedState } from "@/components/business/subscription-locked-state";
import { SubscriptionHero } from "@/components/business/subscription-hero";
import { SubscriptionFaq } from "@/components/business/subscription-faq";
import { SubscriptionTrust } from "@/components/business/subscription-trust";
import type { PlanSlug } from "@/lib/subscription/types";

export default async function BusinessSubscriptionPage() {
  const t = await getTranslations("business.subscription");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6 animate-fade-in px-1">
        <SubscriptionHero />
        <ProviderCreateFormLoader />
      </div>
    );
  }

  if (!isProviderSubscriptionUnlocked(provider.status)) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-8 animate-fade-in px-1">
        <SubscriptionHero />
        <SubscriptionLockedState status={provider.status} />
      </div>
    );
  }

  const { subscription, payments, pendingPayment } = await getSubscriptionPageData(authUser.id);
  const planSlug = (subscription?.planSlug ?? "free") as PlanSlug;

  return (
    <div className="w-full max-w-5xl space-y-10 overflow-x-hidden animate-fade-in pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:space-y-14 md:space-y-16">
      <SubscriptionHero />

      <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
        {t("intro")}
      </p>

      <BusinessSubscriptionPanel
        currentPlanSlug={planSlug}
        status={subscription?.status ?? "active"}
        expiresAt={subscription?.expiresAt ?? null}
        pendingPayment={pendingPayment}
        payments={payments}
        showFaq={false}
      />

      <SubscriptionFaq />
      <SubscriptionTrust />
    </div>
  );
}
