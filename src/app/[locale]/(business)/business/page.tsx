import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
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
import {
  ONBOARDING_CARD_DISMISS_COOKIE,
  ONBOARDING_DEFER_COOKIE,
  ONBOARDING_REMINDER_DISMISS_COOKIE,
  parseTimestampCookie,
} from "@/lib/business/onboarding-preference";
import { getOnboardingReminderState } from "@/lib/business/onboarding-reminders";
import { getProviderSuccessDashboard } from "@/lib/provider-success/dashboard-service";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { GrowthHero } from "@/components/business/growth-hero";
import { FirstRequestMediaBanner } from "@/components/business/first-request-media-banner";
import { DashboardConversationsPreview } from "@/components/business/conversation-list";
import { ProviderSuccessDashboardView } from "@/components/provider-success/provider-success-dashboard";
import { VerificationDashboardAlert } from "@/components/business/verification-dashboard-alert";
import { OnboardingDashboardCard } from "@/components/business/onboarding/onboarding-dashboard-card";
import type { PlanSlug } from "@/lib/subscription/types";
import type { Locale } from "@/lib/i18n/config";

/**
 * Provider Success Dashboard — soft onboarding encouragement only (no popup loops).
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

  const jar = await cookies();
  const deferredAt = parseTimestampCookie(jar.get(ONBOARDING_DEFER_COOKIE)?.value);
  const onboardingDeferred = Boolean(deferredAt);

  // Force welcome only for unfinished drafts — never after “Later” in this session.
  if (shouldForceOnboarding(provider) && !onboardingDeferred) {
    redirect({ href: "/business/welcome", locale });
  }

  const cardDismissedAt = parseTimestampCookie(jar.get(ONBOARDING_CARD_DISMISS_COOKIE)?.value);
  const reminderDismissedAt = parseTimestampCookie(
    jar.get(ONBOARDING_REMINDER_DISMISS_COOKIE)?.value,
  );
  const reminder = getOnboardingReminderState({
    provider,
    verification,
    cardDismissedAt,
    reminderDismissedAt,
    locale,
  });

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

  const onboardingHref =
    provider.status === "changes_requested" ||
    verification.status === "rejected" ||
    provider.verificationStatus === "rejected"
      ? "/business/verification"
      : "/business/welcome";

  return (
    <div className="w-full max-w-full space-y-8 overflow-x-hidden animate-fade-in">
      <GrowthHero
        planSlug={planSlug}
        businessName={businessName}
        pendingRequests={pendingRequests}
        unreadMessages={unreadMessages}
      />

      <VerificationDashboardAlert provider={provider} verification={verification} />

      {reminder.showDashboardCard ? (
        <OnboardingDashboardCard copyId={reminder.copyId} href={onboardingHref} />
      ) : null}

      <FirstRequestMediaBanner
        providerId={provider.id}
        totalRequests={totalRequests}
        galleryCount={provider.gallery.length}
      />

      <ProviderSuccessDashboardView
        data={success}
        showVerify={showVerification}
        userId={authUser.id}
        providerId={provider.id}
      />

      <DashboardConversationsPreview conversations={conversations} />
    </div>
  );
}
