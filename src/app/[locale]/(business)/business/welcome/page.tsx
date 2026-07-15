import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { BusinessSubscriptionPanel } from "@/components/business/business-subscription-panel";
import type { PlanSlug } from "@/lib/subscription/types";

export default async function BusinessWelcomePage() {
  const t = await getTranslations("business.welcome");
  const locale = await getLocale();
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    redirect({ href: "/business", locale: locale as "ar" | "en" });
  }

  const { subscription, payments, pendingPayment } = await getSubscriptionPageData(authUser.id);

  return (
    <div className="space-y-10 animate-fade-in py-4">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-[var(--dalily-gold)]/15 text-3xl">
          🎉
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#5C6478] sm:text-lg">{t("subtitle")}</p>
        <p className="mt-2 text-base font-medium text-[var(--dalily-navy)]">{t("prompt")}</p>
      </div>

      <BusinessSubscriptionPanel
        currentPlanSlug={(subscription?.planSlug ?? "free") as PlanSlug}
        status={subscription?.status ?? "active"}
        expiresAt={subscription?.expiresAt ?? null}
        pendingPayment={pendingPayment}
        payments={payments}
        mode="welcome"
      />
    </div>
  );
}
