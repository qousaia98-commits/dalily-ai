import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getCategoryGroupsWithLeaves } from "@/lib/categories/queries";
import {
  getProviderVerificationForOwner,
  toBusinessVerificationView,
} from "@/lib/verification/queries";
import {
  resolveOnboardingPhase,
  shouldShowWelcomeLanding,
} from "@/lib/business/onboarding";
import { BusinessOnboardingWizard } from "@/components/business/onboarding/business-onboarding-wizard";
import type { Locale } from "@/lib/i18n/config";

/**
 * Voluntary onboarding entry — never blocked by “Later” defer.
 * Defer only stops forced redirects from the dashboard.
 */
export default async function BusinessWelcomePage() {
  const t = await getTranslations("business.onboarding");
  const locale = (await getLocale()) as Locale;
  const authUser = await requireAuthUser();
  const ownedProvider = await getOwnedProvider(authUser.id);

  if (!ownedProvider) {
    redirect({ href: "/business", locale });
  }

  const provider = ownedProvider!;

  if (provider.status === "active") {
    redirect({ href: "/business", locale });
  }

  const [verificationRow, categoryGroups] = await Promise.all([
    getProviderVerificationForOwner(provider.id),
    getCategoryGroupsWithLeaves(),
  ]);
  const verification = toBusinessVerificationView(verificationRow);
  const phase = resolveOnboardingPhase(provider, verification, locale);
  // Skip intro when returning voluntarily mid-flow (docs already started).
  const showWelcomeFirst = shouldShowWelcomeLanding(provider, verification);

  const categorySlug =
    categoryGroups
      .flatMap((g) => g.leaves)
      .find((c) => c.id === provider.categoryId)?.slug ?? "";

  const alreadySubmitted =
    provider.status === "pending_review" || verification.status === "pending";

  return (
    <div className="w-full max-w-full space-y-8 overflow-x-hidden animate-fade-in py-2">
      {!showWelcomeFirst || phase !== "identity" ? (
        <div className="mx-auto max-w-lg text-center sm:text-start">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dalily-gold)]">
            {t("eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{t("subtitle")}</p>
        </div>
      ) : null}

      <BusinessOnboardingWizard
        provider={provider}
        verification={verification}
        categoryGroups={categoryGroups}
        categorySlug={categorySlug}
        initialPhase={phase}
        alreadySubmitted={alreadySubmitted}
        showWelcomeFirst={showWelcomeFirst}
      />
    </div>
  );
}
