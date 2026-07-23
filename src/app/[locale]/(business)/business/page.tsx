import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { getLocalizedField } from "@/types/provider.types";
import { countUnreadConversations } from "@/lib/business/conversations";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { countPendingRequestsForOwner, countTotalRequestsForProvider } from "@/lib/service-requests/queries";
import {
  getProviderVerificationForOwner,
  toBusinessVerificationView,
} from "@/lib/verification/queries";
import { shouldForceOnboarding } from "@/lib/business/onboarding";
import { getProviderSuccessDashboard } from "@/lib/provider-success/dashboard-service";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { GrowthHero } from "@/components/business/growth-hero";
import { ChangesRequiredCard } from "@/components/business/changes-required-card";
import { FirstRequestMediaBanner } from "@/components/business/first-request-media-banner";
import { DashboardConversationsPreview } from "@/components/business/conversation-list";
import { ProviderSuccessDashboardView } from "@/components/provider-success/provider-success-dashboard";
import type { PlanSlug } from "@/lib/subscription/types";
import type { Locale } from "@/lib/i18n/config";

/**
 * Provider Success Dashboard — central business workspace (Sprint 39).
 * Reuses Booking, Chat, Reviews, Analytics, Notifications, Provider modules.
 */
export default async function BusinessDashboardPage() {
  const t = await getTranslations("business.dashboard");
  const locale = (await getLocale()) as Locale;
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("noProviderSubtitle")}</p>
        </div>
        <ProviderCreateFormLoader />
      </div>
    );
  }

  const verificationRow = await getProviderVerificationForOwner(provider.id);
  const verification = toBusinessVerificationView(verificationRow);

  if (shouldForceOnboarding(provider)) {
    redirect({ href: "/business/welcome", locale });
  }

  const [{ subscription }, { conversations }, pendingRequests, totalRequests, success] =
    await Promise.all([
      getSubscriptionPageData(authUser.id),
      loadBusinessConversations(authUser.id),
      countPendingRequestsForOwner(authUser.id),
      countTotalRequestsForProvider(provider.id),
      getProviderSuccessDashboard({
        provider,
        ownerId: authUser.id,
        verification,
      }),
    ]);

  const planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
  const businessName = getLocalizedField(provider.name, locale) || provider.id;
  const unreadMessages = countUnreadConversations(conversations);

  const showVerification =
    provider.verificationStatus !== "verified" ||
    provider.status === "draft" ||
    provider.status === "pending_review" ||
    provider.status === "changes_requested";

  return (
    <div className="w-full max-w-full space-y-8 overflow-x-hidden animate-fade-in">
      <GrowthHero
        planSlug={planSlug}
        businessName={businessName}
        pendingRequests={pendingRequests}
        unreadMessages={unreadMessages}
      />

      {provider.status === "changes_requested" && provider.adminReviewNote ? (
        <ChangesRequiredCard note={provider.adminReviewNote} />
      ) : null}

      <FirstRequestMediaBanner
        providerId={provider.id}
        totalRequests={totalRequests}
        galleryCount={provider.gallery.length}
      />

      <ProviderSuccessDashboardView data={success} showVerify={showVerification} />

      <DashboardConversationsPreview conversations={conversations} />
    </div>
  );
}
